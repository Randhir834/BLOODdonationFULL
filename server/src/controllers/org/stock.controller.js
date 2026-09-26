import { env } from "../../config/env.js";
import { INVENTORY_TYPES, ORG_LIMITS, ROLES } from "../../constants/index.js";
import * as audit from "../../services/auditService.js";
import { discardUnit, ledgerFor, recordBlood } from "../../services/inventoryService.js";
import * as notifications from "../../services/notificationService.js";
import { availableMl } from "../../services/orgRequestService.js";
import {
  findUnitOr404,
  listMovements,
  listShipments,
  listUnits,
  receiveShipment,
  stockSummary,
  unitView,
  updateUnit,
} from "../../services/orgStockService.js";
import { displayName, findUserByPhone } from "../../services/userService.js";
import { HttpError } from "../../utils/HttpError.js";
import { paginate } from "../../utils/pagination.js";
import { DAY_MS } from "../../utils/time.js";

const label = (record) => `${record.quantity} ML ${record.bloodGroup}`;
const targetOf = (record) => ({ type: "inventory", id: record._id, label: label(record) });
const isBank = (user) => user.role === ROLES.ORGANISATION;

// A collection time this far ahead of the server clock is put down to the two clocks disagreeing, not a mistake.
const CLOCK_SKEW_MS = 10 * 60 * 1000;

/** Collection and expiry dates a person typed, checked against each other and the clock. */
const unitDates = ({ collectedAt, expiresAt }) => {
  const now = Date.now();
  const collected = collectedAt ? new Date(collectedAt).getTime() : now;
  if (collected > now + CLOCK_SKEW_MS)
    throw new HttpError(400, "The collection date can not be in the future");
  if (expiresAt) {
    const expires = new Date(expiresAt).getTime();
    if (expires <= now)
      throw new HttpError(400, "This blood has already expired, it can not be added to stock");
    if (expires <= collected) throw new HttpError(400, "The expiry date must be after the collection date");
    if (expires - collected > ORG_LIMITS.MAX_SHELF_DAYS * DAY_MS) {
      throw new HttpError(
        400,
        `The expiry date is more than ${ORG_LIMITS.MAX_SHELF_DAYS} days after collection`
      );
    }
  } else if (collected + env.SHELF_LIFE_DAYS * DAY_MS <= now) {
    throw new HttpError(
      400,
      `Blood collected that long ago has passed its ${env.SHELF_LIFE_DAYS} day shelf life, enter its expiry date`
    );
  }
  return {
    ...(collectedAt && { collectedAt: new Date(collectedAt).toISOString() }),
    ...(expiresAt && { expiresAt: new Date(expiresAt).toISOString() }),
  };
};

// After blood leaves stock: tell the owner if a group has just dropped under the low-stock line.
const checkLowStock = async (owner, bloodGroup, removedMl) => {
  try {
    await notifications.notifyIfLowStock(owner, bloodGroup, removedMl, await availableMl(owner, bloodGroup));
  } catch {
    // an alert that could not be worked out never fails the action that caused it
  }
};

// GET /org/stock: stock per blood group
export const summary = async (req, res) => {
  res.json({ success: true, stock: await stockSummary(req.user) });
};

// GET /org/stock/units?state=&bloodGroup=&q=&expiring=&sort=&page=&pageSize=
export const units = async (req, res) => {
  const { page, pageSize, expiring, ...filters } = req.validated.query;
  const { units: rows, truncated } = await listUnits(req.user, { ...filters, expiring: Boolean(expiring) });
  const result = paginate(rows, page, pageSize);
  res.json({ success: true, total: result.total, page, pageSize, truncated, units: result.rows });
};

// GET /org/stock/units/:id
export const unit = async (req, res) => {
  res.json({ success: true, unit: unitView(await findUnitOr404(req.user, req.validated.params.id)) });
};

// POST /org/stock/receive: blood coming in. A blood bank records a donation (from a donor with an account in
// the app, found by phone, or from a walk-in donor); a hospital records blood it received from elsewhere.
export const receive = async (req, res) => {
  const { bloodGroup, quantity, sourcePhone, sourceName, bagNumber, storageLocation, note, ...dates } =
    req.validated.body;
  const owner = req.user;
  const details = {
    ...unitDates(dates),
    bagNumber,
    storageLocation,
    note,
    recordedBy: displayName(owner),
  };

  let source;
  if (isBank(owner) && sourcePhone && (await findUserByPhone(sourcePhone))) {
    source = { phone: sourcePhone };
  } else {
    if (!sourceName) {
      throw new HttpError(
        isBank(owner) ? 404 : 400,
        isBank(owner)
          ? "No donor account has this number. Enter the donor's name to record a walk-in donor."
          : "Enter who the blood came from"
      );
    }
    source = { walkIn: { name: sourceName, phone: sourcePhone || "" } };
  }

  const record = await recordBlood({
    organisation: owner._id,
    inventoryType: INVENTORY_TYPES.IN,
    bloodGroup,
    quantity,
    ledger: ledgerFor(owner),
    details,
    ...source,
  });
  await audit.recordActivity(owner, "inventory.add", targetOf(record), {
    bloodGroup,
    quantity,
    source: record.counterpartName,
    unitId: record.unitId,
  });
  res.status(201).json({ success: true, record: unitView(record) });
};

// POST /org/stock/issue: blood going out, first-expiring-first
export const issue = async (req, res) => {
  const { bloodGroup, quantity, recipientPhone, recipientName, reference, note } = req.validated.body;
  const owner = req.user;

  let recipient;
  // A blood bank issuing to a hospital with an account is recorded against that hospital, who then sees it in
  // its app (and can confirm it arrived on the website). Everyone else is named on the record.
  if (isBank(owner) && recipientPhone && (await findUserByPhone(recipientPhone))) {
    recipient = { phone: recipientPhone };
  } else {
    if (!recipientName) {
      throw new HttpError(
        isBank(owner) ? 404 : 400,
        isBank(owner)
          ? "No hospital account has this number. Enter a name to record it against a patient or another organisation."
          : "Enter who the blood is for"
      );
    }
    recipient = { walkIn: { name: recipientName, phone: recipientPhone || "" } };
  }

  const record = await recordBlood({
    organisation: owner._id,
    inventoryType: INVENTORY_TYPES.OUT,
    bloodGroup,
    quantity,
    ledger: ledgerFor(owner),
    details: { reference, note, recordedBy: displayName(owner) },
    ...recipient,
  });
  await audit.recordActivity(owner, "inventory.issue", targetOf(record), {
    bloodGroup,
    quantity,
    recipient: record.counterpartName,
    reference,
  });
  await checkLowStock(owner, bloodGroup, quantity);
  res.status(201).json({ success: true, record });
};

// PATCH /org/stock/units/:id: corrects a unit that is still in stock
export const update = async (req, res) => {
  const patch = { ...req.validated.body };
  if (patch.expiresAt) patch.expiresAt = new Date(patch.expiresAt).toISOString();
  const before = await findUnitOr404(req.user, req.validated.params.id);
  const unit = await updateUnit(req.user, before._id, patch);
  await audit.recordActivity(req.user, "inventory.update", targetOf(unit), {
    unitId: unit.unitId,
    fields: Object.keys(patch),
  });
  res.json({ success: true, unit: unitView(unit) });
};

// POST /org/stock/units/:id/discard
export const discard = async (req, res) => {
  const owner = req.user;
  const unit = await discardUnit(
    req.validated.params.id,
    { ...req.validated.body, organisation: owner._id, ledger: ledgerFor(owner) },
    { label: displayName(owner) }
  );
  await audit.recordActivity(
    owner,
    "inventory.discard",
    { type: "inventory", id: req.validated.params.id, label: label(unit) },
    { bloodGroup: unit.bloodGroup, quantity: unit.quantity, reason: unit.discardReason }
  );
  await checkLowStock(owner, unit.bloodGroup, unit.quantity);
  res.json({ success: true, unit: unitView(unit) });
};

// GET /org/stock/movements?kind=&bloodGroup=&q=&from=&to=&page=&pageSize=
export const movements = async (req, res) => {
  const { page, pageSize, ...filters } = req.validated.query;
  const { movements: rows, truncated } = await listMovements(req.user, filters);
  const result = paginate(rows, page, pageSize);
  res.json({ success: true, total: result.total, page, pageSize, truncated, movements: result.rows });
};

// GET /org/shipments?status=: blood blood banks issued to this hospital, and whether it was confirmed
export const shipments = async (req, res) => {
  if (isBank(req.user)) throw new HttpError(403, "Only hospitals receive shipments");
  const { shipments: rows, truncated } = await listShipments(req.user, req.validated.query);
  res.json({ success: true, shipments: rows, truncated });
};

// POST /org/shipments/:id/receive: the hospital confirms the blood arrived, which adds it to its stock
export const receiveDelivery = async (req, res) => {
  const result = await receiveShipment(req.user, req.validated.params.id);
  await audit.recordActivity(
    req.user,
    "inventory.receive-shipment",
    { type: "inventory", id: result.shipmentId, label: `${result.units.length} unit(s)` },
    { unitIds: result.units.map((unit) => unit.unitId) }
  );
  res.status(201).json({ success: true, ...result });
};
