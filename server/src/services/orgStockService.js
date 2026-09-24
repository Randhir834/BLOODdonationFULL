import { env } from "../config/env.js";
import { getDb } from "../config/firebase.js";
import { BLOOD_GROUPS, INVENTORY_TYPES, ROLES, UNIT_STATUS } from "../constants/index.js";
import { HttpError } from "../utils/HttpError.js";
import { DAY_MS, dayKey } from "../utils/time.js";
import { inventoryCollection } from "./collections.js";
import { findRecords, isDrawable, ledgerFor, summariseUnits } from "./inventoryService.js";
import { bumpStock } from "./stockService.js";
import { displayName, findUserById } from "./userService.js";

/*
 * Everything the hospital / blood bank website needs on top of inventoryService: what is in stock unit by
 * unit, correcting a unit, the movement history, and a hospital confirming blood a blood bank sent it.
 * Both kinds of account go through `ledgerFor(user)`, so a blood bank works on `inventory` and a hospital
 * on `hospitalStock` with the same code.
 */

const remaining = (unit) => unit.quantity - (unit.consumedQuantity || 0);

/** A stored unit plus what the screens need to know about it right now. */
export const unitView = (unit, nowIso = new Date().toISOString()) => {
  const warnBy = new Date(Date.parse(nowIso) + env.EXPIRY_WARNING_DAYS * DAY_MS).toISOString();
  const left = unit.status === UNIT_STATUS.AVAILABLE ? remaining(unit) : 0;
  const expired = unit.status === UNIT_STATUS.AVAILABLE && unit.expiresAt < nowIso;
  return {
    ...unit,
    remaining: left,
    // "expired" is not stored: it is an available unit past its expiry date, until someone discards it.
    state: expired ? "expired" : unit.status,
    expiringSoon: !expired && left > 0 && unit.expiresAt <= warnBy,
  };
};

const isUnit = (record) => record.inventoryType === INVENTORY_TYPES.IN && Boolean(record.status);

const compareExpiry = (a, b) => (a.expiresAt || "9999").localeCompare(b.expiresAt || "9999");

const matchesText = (needle, values) =>
  values.some((value) =>
    String(value || "")
      .toLowerCase()
      .includes(needle)
  );

/**
 * Every blood group's stock, from one read of the account's records: the same running figures the mobile app
 * shows (in, out, discarded, available, expiring soon) plus what a stock manager wants at a glance.
 */
export const stockSummary = async (owner) => {
  const ledger = ledgerFor(owner);
  const { records, truncated } = await findRecords({ organisation: owner._id }, undefined, ledger);
  const nowIso = new Date().toISOString();
  const totals = summariseUnits(records);
  const units = records.filter(isUnit).map((unit) => unitView(unit, nowIso));

  const groups = BLOOD_GROUPS.map((bloodGroup) => {
    const own = units.filter((unit) => unit.bloodGroup === bloodGroup);
    const drawable = own.filter((unit) => isDrawable(unit, nowIso));
    const expired = own.filter((unit) => unit.state === "expired");
    const { available, expiringSoonMl, totalIn, totalOut, totalDiscarded } = totals[bloodGroup];
    return {
      bloodGroup,
      available,
      expiringSoonMl,
      totalIn,
      totalOut,
      totalDiscarded,
      availableUnits: drawable.length,
      expiredUnits: expired.length,
      expiredMl: expired.reduce((sum, unit) => sum + remaining(unit), 0),
      nextExpiry: [...drawable].sort(compareExpiry)[0]?.expiresAt ?? null,
      status: available <= 0 ? "out" : available < env.LOW_STOCK_ML ? "low" : "ok",
    };
  });

  return {
    groups,
    lowStockMl: env.LOW_STOCK_ML,
    expiryWarningDays: env.EXPIRY_WARNING_DAYS,
    totalAvailable: groups.reduce((sum, group) => sum + group.available, 0),
    totalUnits: groups.reduce((sum, group) => sum + group.availableUnits, 0),
    expiringSoonMl: groups.reduce((sum, group) => sum + group.expiringSoonMl, 0),
    expiredUnits: groups.reduce((sum, group) => sum + group.expiredUnits, 0),
    expiredMl: groups.reduce((sum, group) => sum + group.expiredMl, 0),
    truncated,
  };
};

/** The account's blood units, filtered and sorted. `state` is one of available, issued, discarded, expired, legacy. */
export const listUnits = async (owner, { state, bloodGroup, q, expiring, sort = "newest" } = {}) => {
  const { records, truncated } = await findRecords(
    { organisation: owner._id, inventoryType: INVENTORY_TYPES.IN, bloodGroup },
    undefined,
    ledgerFor(owner)
  );
  const nowIso = new Date().toISOString();
  const needle = (q || "").trim().toLowerCase();

  let units = records
    .filter(isUnit)
    .map((unit) => unitView(unit, nowIso))
    .filter((unit) => {
      if (state && unit.state !== state) return false;
      if (expiring && !unit.expiringSoon) return false;
      return (
        !needle ||
        matchesText(needle, [
          unit.unitId,
          unit.bagNumber,
          unit.counterpartName,
          unit.phone,
          unit.storageLocation,
        ])
      );
    });

  if (sort === "expiry") units = units.sort(compareExpiry);
  if (sort === "quantity") units = units.sort((a, b) => b.remaining - a.remaining);
  return { units, truncated };
};

export const findUnitOr404 = async (owner, id) => {
  const doc = await ledgerFor(owner).collection().doc(id).get();
  if (!doc.exists || doc.data().organisation !== owner._id || !isUnit(doc.data())) {
    throw new HttpError(404, "Unit not found");
  }
  return { _id: doc.id, ...doc.data() };
};

/**
 * Corrects a unit that is still in stock. Storage details and the expiry date can always be changed while it
 * is available; the amount and the blood group only while none of it has been issued (a wrong entry is fixed,
 * issued blood is never rewritten). The running totals move in the same transaction.
 */
export const updateUnit = async (owner, id, patch) => {
  const ledger = ledgerFor(owner);
  return getDb().runTransaction(async (tx) => {
    const ref = ledger.collection().doc(id);
    const doc = await tx.get(ref);
    if (!doc.exists || doc.data().organisation !== owner._id || !isUnit(doc.data())) {
      throw new HttpError(404, "Unit not found");
    }
    const unit = { _id: doc.id, ...doc.data() };
    if (unit.status !== UNIT_STATUS.AVAILABLE)
      throw new HttpError(400, `This unit is already ${unit.status}`);

    const changesStock =
      (patch.quantity !== undefined && patch.quantity !== unit.quantity) ||
      (patch.bloodGroup !== undefined && patch.bloodGroup !== unit.bloodGroup);
    if (changesStock) {
      if (unit.consumedQuantity > 0) {
        throw new HttpError(
          400,
          "Blood has already been issued from this unit, so its amount and group can not be changed"
        );
      }
      if (unit.openingBalance) {
        throw new HttpError(400, "This is an opening balance unit, its amount and group can not be changed");
      }
    }

    const update = { updatedAt: new Date().toISOString() };
    ["bagNumber", "storageLocation", "note", "expiresAt", "quantity", "bloodGroup"].forEach((field) => {
      if (patch[field] !== undefined) update[field] = patch[field];
    });
    if (update.expiresAt && update.expiresAt <= unit.collectedAt) {
      throw new HttpError(400, "The expiry date must be after the collection date");
    }

    tx.update(ref, update);
    if (changesStock && ledger.trackTotals) {
      bumpStock(
        tx,
        { bloodGroup: unit.bloodGroup, inventoryType: INVENTORY_TYPES.IN, quantity: unit.quantity },
        -1
      );
      bumpStock(
        tx,
        {
          bloodGroup: update.bloodGroup ?? unit.bloodGroup,
          inventoryType: INVENTORY_TYPES.IN,
          quantity: update.quantity ?? unit.quantity,
        },
        1
      );
    }
    return { ...unit, ...update };
  });
};

// ---------------------------------------------------------------------------------------------------------
// Movement history: one line for every time blood entered, left or was thrown away. It is worked out from the
// stock records themselves (a unit's creation, its discard, an issue), so it can never disagree with stock.

const movementOf = (record, kind, at, extra = {}) => ({
  _id: `${record._id}:${kind}`,
  recordId: record._id,
  kind, // received | issued | discarded
  at,
  bloodGroup: record.bloodGroup,
  quantity: record.quantity,
  unitId: record.unitId ?? null,
  counterpartName: record.counterpartName ?? null,
  counterpartRole: record.counterpartRole ?? null,
  phone: record.phone || "",
  reference: record.reference ?? null,
  note: record.note ?? null,
  requestId: record.requestId ?? null,
  unitsConsumed: record.unitsConsumed ?? null,
  receipt: record.receipt ?? null,
  ...extra,
});

export const buildMovements = (records) =>
  records
    .flatMap((record) => {
      if (record.inventoryType === INVENTORY_TYPES.OUT)
        return [movementOf(record, "issued", record.createdAt)];
      if (record.status === UNIT_STATUS.LEGACY) return [];
      const lines = [
        movementOf(record, "received", record.createdAt, { openingBalance: Boolean(record.openingBalance) }),
      ];
      if (record.status === UNIT_STATUS.DISCARDED) {
        lines.push(
          movementOf(record, "discarded", record.discardedAt || record.updatedAt, {
            quantity: record.quantity,
            reason: record.discardReason ?? null,
            note: record.discardNote || record.note || null,
          })
        );
      }
      return lines;
    })
    .sort((a, b) => (a.at < b.at ? 1 : -1));

/** Movement history, newest first, filtered. `from`/`to` are days (YYYY-MM-DD) in the site's time zone. */
export const listMovements = async (owner, { kind, bloodGroup, q, from, to } = {}) => {
  const { records, truncated } = await findRecords(
    { organisation: owner._id, bloodGroup },
    undefined,
    ledgerFor(owner)
  );
  const needle = (q || "").trim().toLowerCase();
  const movements = buildMovements(records).filter((movement) => {
    if (kind && movement.kind !== kind) return false;
    const day = dayKey(new Date(movement.at));
    if (from && day < from) return false;
    if (to && day > to) return false;
    return (
      !needle ||
      matchesText(needle, [
        movement.unitId,
        movement.counterpartName,
        movement.phone,
        movement.reference,
        movement.note,
      ])
    );
  });
  return { movements, truncated };
};

// ---------------------------------------------------------------------------------------------------------
// Hospitals: blood a blood bank has issued to the hospital is only counted in the hospital's stock once the
// hospital confirms it arrived. Confirming creates the hospital's own units, keeping each unit's expiry date.

/** Records where a blood bank issued blood to this hospital, newest first, with what became of each. */
export const listShipments = async (hospital, { status } = {}) => {
  const { records, truncated } = await findRecords({
    hospital: hospital._id,
    inventoryType: INVENTORY_TYPES.OUT,
  });
  const banks = new Map();
  await Promise.all(
    [...new Set(records.map((record) => record.organisation))].map(async (id) => {
      banks.set(id, await findUserById(id));
    })
  );
  const shipments = records
    .map((record) => ({
      _id: record._id,
      bloodGroup: record.bloodGroup,
      quantity: record.quantity,
      createdAt: record.createdAt,
      requestId: record.requestId ?? null,
      from: banks.get(record.organisation)
        ? { _id: record.organisation, name: displayName(banks.get(record.organisation)) }
        : null,
      units: (record.unitsConsumed || []).map(({ unitId, quantity }) => ({ unitId, quantity })),
      receipt: record.receipt ?? null,
      status: record.receipt ? "received" : "pending",
    }))
    .filter((shipment) => !status || shipment.status === status);
  return { shipments, truncated };
};

/** The hospital confirms a shipment arrived: each unit drawn for it becomes a unit in the hospital's stock. */
export const receiveShipment = async (hospital, recordId) => {
  if (hospital.role !== ROLES.HOSPITAL) throw new HttpError(403, "Only a hospital can receive a shipment");
  const ledger = ledgerFor(hospital);
  const now = new Date().toISOString();

  const first = await inventoryCollection().doc(recordId).get();
  if (
    !first.exists ||
    first.data().hospital !== hospital._id ||
    first.data().inventoryType !== INVENTORY_TYPES.OUT
  ) {
    throw new HttpError(404, "Shipment not found");
  }
  const bank = await findUserById(first.data().organisation);

  return getDb().runTransaction(async (tx) => {
    const recordRef = inventoryCollection().doc(recordId);
    const record = { _id: recordId, ...(await tx.get(recordRef)).data() };
    if (record.receipt) throw new HttpError(409, "This shipment was already received");

    const draws = record.unitsConsumed?.length
      ? record.unitsConsumed
      : [{ unitId: null, unitRefId: null, quantity: record.quantity }];
    const sources = await Promise.all(
      draws.map((draw) => (draw.unitRefId ? tx.get(inventoryCollection().doc(draw.unitRefId)) : null))
    );

    const created = draws.map((draw, index) => {
      const ref = ledger.collection().doc();
      const source = sources[index]?.exists ? sources[index].data() : null;
      const collectedAt = source?.collectedAt || record.createdAt;
      const unit = {
        inventoryType: INVENTORY_TYPES.IN,
        bloodGroup: record.bloodGroup,
        quantity: draw.quantity,
        phone: bank?.phone ?? "",
        organisation: hospital._id,
        counterpartName: bank ? displayName(bank) : "Blood bank",
        counterpartId: record.organisation,
        counterpartRole: ROLES.ORGANISATION,
        unitId: `U-${now.slice(0, 10).replace(/-/g, "")}-${ref.id.slice(-6).toUpperCase()}`,
        status: UNIT_STATUS.AVAILABLE,
        collectedAt,
        expiresAt:
          source?.expiresAt || new Date(Date.parse(collectedAt) + env.SHELF_LIFE_DAYS * DAY_MS).toISOString(),
        consumedQuantity: 0,
        sourceRecordId: record._id,
        ...(draw.unitId && { sourceUnitId: draw.unitId }),
        ...(record.requestId && { requestId: record.requestId }),
        createdAt: now,
        updatedAt: now,
      };
      tx.set(ref, unit);
      return { _id: ref.id, unitId: unit.unitId };
    });

    const receipt = { receivedAt: now, receivedBy: hospital._id, unitIds: created.map((unit) => unit._id) };
    tx.update(recordRef, { receipt, updatedAt: now });
    return { shipmentId: record._id, receipt, units: created };
  });
};
