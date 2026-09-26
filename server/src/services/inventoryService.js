import { env } from "../config/env.js";
import { getDb } from "../config/firebase.js";
import {
  BLOOD_GROUPS,
  INVENTORY_TYPES,
  LIMITS,
  RECORD_FIELD,
  ROLES,
  UNIT_STATUS,
} from "../constants/index.js";
import { HttpError } from "../utils/HttpError.js";
import { DAY_MS } from "../utils/time.js";
import { hospitalStockCollection, inventoryCollection } from "./collections.js";
import { bumpDiscarded, bumpStock } from "./stockService.js";
import { displayName, findUserByPhone, findUsersByIds, isApproved } from "./userService.js";

/**
 * Where a hospital or blood bank keeps its stock. A blood bank's is `inventory` (also read by the mobile app
 * and the admin website, and the only one that feeds the platform-wide running totals). A hospital's is
 * `hospitalStock`: same document shape, but kept apart so a hospital's own blood never inflates the blood
 * bank figures the admin dashboard reports. In both, `organisation` is the account that owns the stock.
 */
export const bankLedger = Object.freeze({ collection: inventoryCollection, trackTotals: true });
export const hospitalLedger = Object.freeze({ collection: hospitalStockCollection, trackTotals: false });
export const ledgerFor = (user) => (user.role === ROLES.HOSPITAL ? hospitalLedger : bankLedger);

// Fields a caller may filter on (equality only).
const FILTERABLE = ["organisation", "inventoryType", "bloodGroup", "donar", "hospital"];

const toRecord = (doc) => ({ _id: doc.id, ...doc.data() });

const newestFirst = (a, b) => (a.createdAt < b.createdAt ? 1 : -1);

const applyFilters = (query, filters = {}) =>
  FILTERABLE.reduce(
    (result, field) =>
      typeof filters[field] === "string" ? result.where(field, "==", filters[field]) : result,
    query
  );

// A short, readable label for a unit: e.g. U-20260922-4F7A1B. It is a label, not an id: the Firestore
// document id is what every reference (FEFO draws, deletes) actually points at.
const unitLabel = (now, ref) =>
  `U-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${ref.id.slice(-6).toUpperCase()}`;

/** True while a unit can still be drawn from: not expired, not discarded, not a pre-unit legacy record. */
export const isDrawable = (unit, now) =>
  unit.status === UNIT_STATUS.AVAILABLE &&
  unit.expiresAt > now &&
  unit.quantity - (unit.consumedQuantity || 0) > 0;

/**
 * Records blood coming in from a donor, or issues it to a hospital by phone number.
 *
 * "in" creates one blood unit, with an expiry date `SHELF_LIFE_DAYS` after collection.
 * "out" draws whole units first-expiring-first (FEFO): it never returns less than `quantity`, but may
 * split the last unit it draws from, so an available unit can be partly issued and partly stay in stock.
 * Both the check and the write happen in the same transaction, so two issues can not both succeed against
 * the same blood.
 *
 * `existingTx` lets a caller (e.g. fulfilling a request) fold this into a larger transaction that also
 * re-checks and updates its own document, so the whole thing commits or fails atomically together.
 *
 * `counterpart`, when given (a full user object, e.g. by a request fulfilment that already knows and has
 * re-checked who it is issuing to) is used instead of looking the phone up and requiring it be a donor
 * (for "in") or a hospital (for "out"): a blood request can be made by a donor or a blood bank too, and
 * issuing against it must not be limited to hospitals the way an ordinary manual issue still is. The
 * donor/hospital directory tag is only set when the counterpart actually is a donor or hospital, so an
 * issue against a donor's or blood bank's own request never pollutes their donation/received-blood history.
 */
export const recordBlood = async (
  {
    organisation,
    phone,
    inventoryType,
    bloodGroup,
    quantity,
    counterpart: given,
    requestId,
    // The hospital / blood bank website: which stock it is, and the details a walk-in donor or a patient
    // (someone with no account in the app) can have instead of a phone number that is looked up.
    ledger = bankLedger,
    walkIn,
    details = {},
  },
  existingTx
) => {
  const adding = inventoryType === INVENTORY_TYPES.IN;
  const counterpart = given || (walkIn ? null : await findUserByPhone(phone));
  if (!counterpart && !walkIn) throw new HttpError(404, "User not found");

  if (!given && counterpart) {
    const expectedRole = adding ? ROLES.DONOR : ROLES.HOSPITAL;
    if (counterpart.role !== expectedRole) {
      throw new HttpError(400, adding ? "Not a donor account" : "Not a hospital account");
    }
    // Blood only goes to hospitals an admin has checked.
    if (!isApproved(counterpart)) throw new HttpError(409, "This hospital has not been approved yet");
  }

  const now = new Date().toISOString();
  const record = {
    inventoryType,
    bloodGroup,
    quantity,
    phone: phone ?? counterpart?.phone ?? walkIn?.phone ?? "",
    organisation,
    // Who the blood came from / went to, as it was named at the time (an account can be renamed or removed).
    counterpartName: counterpart ? displayName(counterpart) : walkIn.name,
    ...(counterpart && { counterpartId: counterpart._id, counterpartRole: counterpart.role }),
    ...(details.reference && { reference: details.reference }),
    ...(details.note && { note: details.note }),
    ...(details.recordedBy && { recordedBy: details.recordedBy }),
    // Only tag the field a donation ("in") or an issue ("out") naturally means: an "out" record fulfilling
    // a donor's or blood bank's own request must not be tagged `donar`, or it would show up as a donation
    // in that donor's history even though no blood was ever given by them.
    ...(counterpart &&
    ((adding && counterpart.role === ROLES.DONOR) || (!adding && counterpart.role === ROLES.HOSPITAL))
      ? { [RECORD_FIELD[counterpart.role]]: counterpart._id }
      : {}),
    ...(requestId ? { requestId } : {}),
    createdAt: now,
    updatedAt: now,
  };
  const ref = ledger.collection().doc();
  const track = (tx, sign = 1) => ledger.trackTotals && bumpStock(tx, record, sign);

  if (adding) {
    const collectedAt = details.collectedAt || now;
    const expiresAt =
      details.expiresAt || new Date(Date.parse(collectedAt) + env.SHELF_LIFE_DAYS * DAY_MS).toISOString();
    Object.assign(record, {
      unitId: unitLabel(new Date(now), ref),
      status: UNIT_STATUS.AVAILABLE,
      collectedAt,
      expiresAt,
      consumedQuantity: 0,
      ...(details.bagNumber && { bagNumber: details.bagNumber }),
      ...(details.storageLocation && { storageLocation: details.storageLocation }),
    });
    const run = async (tx) => {
      tx.set(ref, record);
      track(tx);
      return { _id: ref.id, ...record };
    };
    return existingTx ? run(existingTx) : getDb().runTransaction(run);
  }

  const run = async (tx) => {
    const snap = await tx.get(
      ledger
        .collection()
        .where("organisation", "==", organisation)
        .where("bloodGroup", "==", bloodGroup)
        .where("status", "==", UNIT_STATUS.AVAILABLE)
    );
    const units = snap.docs
      .map((doc) => ({ ref: doc.ref, ...doc.data() }))
      .filter((unit) => isDrawable(unit, now))
      .sort((a, b) => (a.expiresAt < b.expiresAt ? -1 : 1)); // FEFO: earliest expiry drawn first

    let remainingToDraw = quantity;
    const draws = [];
    for (const unit of units) {
      if (remainingToDraw <= 0) break;
      const available = unit.quantity - (unit.consumedQuantity || 0);
      const take = Math.min(available, remainingToDraw);
      draws.push({ unit, take });
      remainingToDraw -= take;
    }

    if (remainingToDraw > 0) {
      const trueAvailable = units.reduce(
        (sum, unit) => sum + (unit.quantity - (unit.consumedQuantity || 0)),
        0
      );
      throw new HttpError(409, `Only ${trueAvailable} ML of ${bloodGroup} is available`);
    }

    draws.forEach(({ unit, take }) => {
      const consumedQuantity = (unit.consumedQuantity || 0) + take;
      tx.update(unit.ref, {
        consumedQuantity,
        status: consumedQuantity >= unit.quantity ? UNIT_STATUS.ISSUED : UNIT_STATUS.AVAILABLE,
        updatedAt: now,
      });
    });

    record.unitsConsumed = draws.map(({ unit, take }) => ({
      unitId: unit.unitId,
      unitRefId: unit.ref.id,
      quantity: take,
    }));
    tx.set(ref, record);
    track(tx);
    return { _id: ref.id, ...record };
  };
  return existingTx ? run(existingTx) : getDb().runTransaction(run);
};

/**
 * Blood bank: marks a unit that was never issued as thrown away (contaminated, damaged, failed
 * testing, expired, or another reason). Only a whole, untouched unit can be discarded; once any blood
 * has been issued from a unit, only the part still in stock (none, in that case) could be, not the whole bag.
 *
 * When `organisation` is given, the unit must belong to it or the whole call fails as if the unit did
 * not exist (checked inside the transaction, so nothing is changed before that is known). It is left
 * out only by the trusted, admin-only expiry sweep, which discards across every blood bank.
 */
export const discardUnit = async (id, { reason, note, organisation, ledger = bankLedger }, actor) =>
  getDb().runTransaction(async (tx) => {
    const ref = ledger.collection().doc(id);
    const doc = await tx.get(ref);
    if (!doc.exists) throw new HttpError(404, "Unit not found");
    const unit = toRecord(doc);

    if (unit.inventoryType !== INVENTORY_TYPES.IN || !unit.status) {
      throw new HttpError(400, "Only a blood unit can be discarded");
    }
    if (organisation && unit.organisation !== organisation) throw new HttpError(404, "Unit not found");
    if (unit.status !== UNIT_STATUS.AVAILABLE) {
      throw new HttpError(400, `This unit is already ${unit.status}`);
    }
    if (unit.consumedQuantity > 0) {
      throw new HttpError(400, "Part of this unit has already been issued, it can not be discarded whole");
    }

    const now = new Date().toISOString();
    tx.update(ref, {
      status: UNIT_STATUS.DISCARDED,
      discardReason: reason,
      discardNote: note || "",
      discardedAt: now,
      discardedBy: actor?.label || "",
      updatedAt: now,
    });
    if (ledger.trackTotals) bumpDiscarded(tx, unit.bloodGroup, unit.quantity, 1);
    return { ...unit, status: UNIT_STATUS.DISCARDED, discardReason: reason, discardNote: note || "" };
  });

/**
 * Records matching the equality filters, newest first. Reads at most MAX_SCAN documents (like every
 * other scan in this file), so a caller-supplied `limit` can never be used to (accidentally or not) pull
 * an organisation's or role's entire unbounded history in one request. `truncated` says when there were
 * more matches than MAX_SCAN, so the caller knows the list may be incomplete rather than just short.
 */
export const findRecords = async (filters, limit, ledger = bankLedger) => {
  const snap = await applyFilters(ledger.collection(), filters).limit(LIMITS.MAX_SCAN).get();
  const records = snap.docs.map(toRecord).sort(newestFirst);
  return {
    records: limit ? records.slice(0, limit) : records,
    truncated: snap.size === LIMITS.MAX_SCAN,
  };
};

/** Distinct non-empty values of `field` across the matching records (reads at most MAX_SCAN of them). */
export const distinctValues = async (field, filters) => {
  const snap = await applyFilters(inventoryCollection(), filters).limit(LIMITS.MAX_SCAN).select(field).get();
  return [...new Set(snap.docs.map((doc) => doc.get(field)).filter(Boolean))];
};

/** Replaces user ids in the given fields with the user documents (null when the user was deleted). */
export const populate = async (records, fields) => {
  const ids = records.flatMap((record) => fields.map((field) => record[field]));
  const byId = new Map((await findUsersByIds(ids)).map((user) => [user._id, user]));
  return records.map((record) => {
    const populated = { ...record };
    fields.forEach((field) => {
      if (record[field]) populated[field] = byId.get(record[field]) || null;
    });
    return populated;
  });
};

/**
 * { [bloodGroup]: { totalIn, totalOut, totalDiscarded, available, expiringSoonMl } } for one organisation.
 * `totalIn`/`totalOut`/`totalDiscarded` are running historical totals (what was ever added, issued or
 * thrown away). `available` is the true, present-moment figure: what is left in units that are neither
 * issued nor discarded nor past their expiry date, which is what FEFO issuing would actually draw from.
 * `expiringSoonMl` is the part of `available` that will expire within `EXPIRY_WARNING_DAYS`.
 *
 * An opening-balance unit (see migrateLegacyRecordsToUnits) counts toward `available`, like any other
 * unit, but not toward `totalIn`: it is not new blood, it is the pre-migration balance repackaged into
 * a unit, and that ML was already counted once, by the legacy records it was computed from.
 *
 * Reads at most MAX_SCAN of the organisation's records, like every other scan in this file. `truncated`
 * on the returned object says when there were more, so a very long-lived organisation gets an honestly
 * partial (rather than silently wrong) historical total instead of an unbounded read on every request.
 */
export const organisationTotals = async (organisation, ledger = bankLedger) => {
  const snap = await ledger
    .collection()
    .where("organisation", "==", organisation)
    .limit(LIMITS.MAX_SCAN)
    .select(
      "bloodGroup",
      "inventoryType",
      "quantity",
      "status",
      "consumedQuantity",
      "expiresAt",
      "openingBalance"
    )
    .get();
  return { totals: summariseUnits(snap.docs.map((doc) => doc.data())), truncated: snap.size === LIMITS.MAX_SCAN };
};

/**
 * What a blood bank's home screen shows, from ONE read of its records instead of two separate scans: the
 * per-group totals (exactly `organisationTotals`) and its `recent` newest records. `truncated` says when
 * the organisation had more records than MAX_SCAN, as everywhere else in this file.
 */
export const organisationOverview = async (organisation, recent) => {
  const snap = await inventoryCollection().where("organisation", "==", organisation).limit(LIMITS.MAX_SCAN).get();
  const records = snap.docs.map(toRecord);
  return {
    totals: summariseUnits(records),
    records: records.sort(newestFirst).slice(0, recent),
    truncated: snap.size === LIMITS.MAX_SCAN,
  };
};

/** { [bloodGroup]: totals } from an organisation's raw records, as described on `organisationTotals`. */
export const summariseUnits = (units) => {
  const now = new Date().toISOString();
  const warnBy = new Date(Date.parse(now) + env.EXPIRY_WARNING_DAYS * DAY_MS).toISOString();

  const totals = {};
  BLOOD_GROUPS.forEach(
    (group) =>
      (totals[group] = { totalIn: 0, totalOut: 0, totalDiscarded: 0, available: 0, expiringSoonMl: 0 })
  );

  units.forEach((unit) => {
    const bucket = totals[unit.bloodGroup];
    if (!bucket) return;
    if (unit.inventoryType === INVENTORY_TYPES.OUT) {
      bucket.totalOut += unit.quantity;
      return;
    }
    if (!unit.openingBalance) bucket.totalIn += unit.quantity;
    if (unit.status === UNIT_STATUS.DISCARDED) bucket.totalDiscarded += unit.quantity;
    else if (isDrawable(unit, now)) {
      const left = unit.quantity - (unit.consumedQuantity || 0);
      bucket.available += left;
      if (unit.expiresAt <= warnBy) bucket.expiringSoonMl += left;
    }
  });
  return totals;
};

/**
 * Admin: newest records first, optionally filtered by type / blood group / organisation.
 * Reads at most MAX_SCAN documents, `truncated` says when there were more.
 */
export const listRecords = async ({ inventoryType, bloodGroup, organisation }) => {
  const filters = { inventoryType, bloodGroup, organisation };
  const filtered = Object.values(filters).some(Boolean);
  const base = applyFilters(inventoryCollection(), filters);
  // Equality filters plus a sort would need a composite index, so filtered lists are sorted in memory.
  const query = filtered
    ? base.limit(LIMITS.MAX_SCAN)
    : base.orderBy("createdAt", "desc").limit(LIMITS.MAX_SCAN);
  const snap = await query.get();
  return {
    records: snap.docs.map(toRecord).sort(newestFirst),
    truncated: snap.size === LIMITS.MAX_SCAN,
  };
};

/**
 * Removes a record and reverses what it did to stock:
 * - deleting an "out" record gives its ML back to the units it was drawn from
 * - deleting a discarded unit takes it back out of the discarded total
 * - a unit that any blood has been issued from can not be deleted (delete the issue instead, first)
 * Returns the record, or null if it does not exist.
 */
export const deleteRecord = (id) =>
  getDb().runTransaction(async (tx) => {
    const ref = inventoryCollection().doc(id);
    const doc = await tx.get(ref);
    if (!doc.exists) return null;
    const record = toRecord(doc);

    let unitDocs = [];
    if (record.inventoryType === INVENTORY_TYPES.OUT && record.unitsConsumed?.length) {
      unitDocs = await Promise.all(
        record.unitsConsumed.map((draw) => tx.get(inventoryCollection().doc(draw.unitRefId)))
      );
    } else if (record.inventoryType === INVENTORY_TYPES.IN && (record.consumedQuantity || 0) > 0) {
      throw new HttpError(400, "This unit has already been issued from, delete the issue instead");
    }

    const now = new Date().toISOString();
    unitDocs.forEach((unitDoc, index) => {
      if (!unitDoc.exists) return; // the unit itself was deleted separately, nothing left to restore
      const draw = record.unitsConsumed[index];
      const consumedQuantity = Math.max(0, (unitDoc.data().consumedQuantity || 0) - draw.quantity);
      tx.update(unitDoc.ref, { consumedQuantity, status: UNIT_STATUS.AVAILABLE, updatedAt: now });
    });

    tx.delete(ref);
    bumpStock(tx, record, -1);
    if (record.inventoryType === INVENTORY_TYPES.IN && record.status === UNIT_STATUS.DISCARDED) {
      bumpDiscarded(tx, record.bloodGroup, record.quantity, -1);
    }
    return record;
  });

/** All records created at or after `iso` (an ISO date string). */
export const recordsSince = async (iso) => {
  const snap = await inventoryCollection().where("createdAt", ">=", iso).get();
  return snap.docs.map(toRecord);
};

export const latestRecords = async (limit) => {
  const snap = await inventoryCollection().orderBy("createdAt", "desc").limit(limit).get();
  return snap.docs.map(toRecord);
};

export const countRecords = async () => (await inventoryCollection().count().get()).data().count;

/**
 * Admin dashboard: how many available units, across every blood bank, are already past their expiry
 * date or will be soon (within `warningDays`). Bounded like other admin-wide scans; `truncated` says
 * when there were more available units than that to check.
 */
export const expirySummary = async (warningDays) => {
  const nowIso = new Date().toISOString();
  const warnByIso = new Date(Date.parse(nowIso) + warningDays * DAY_MS).toISOString();
  const snap = await inventoryCollection()
    .where("status", "==", UNIT_STATUS.AVAILABLE)
    .limit(LIMITS.MAX_SCAN)
    .select("bloodGroup", "quantity", "consumedQuantity", "expiresAt")
    .get();

  const remaining = (unit) => unit.quantity - (unit.consumedQuantity || 0);
  const units = snap.docs.map((doc) => doc.data());
  const expired = units.filter((unit) => unit.expiresAt < nowIso);
  const expiringSoon = units.filter((unit) => unit.expiresAt >= nowIso && unit.expiresAt <= warnByIso);

  return {
    expiredUnits: expired.length,
    expiredMl: expired.reduce((sum, unit) => sum + remaining(unit), 0),
    expiringSoonUnits: expiringSoon.length,
    expiringSoonMl: expiringSoon.reduce((sum, unit) => sum + remaining(unit), 0),
    truncated: snap.size === LIMITS.MAX_SCAN,
  };
};

/**
 * Repair tool (npm run sweep-expired): marks every available unit whose expiry date has passed as
 * discarded, reason "expired". Nothing needs this to be correct: available totals already exclude
 * expired units live. It only keeps the records themselves, and the discarded running totals, tidy.
 * A unit that blood has already been partly issued from is left for a person to judge and is not swept.
 */
export const sweepExpiredUnits = async () => {
  const nowIso = new Date().toISOString();
  const snap = await inventoryCollection()
    .where("status", "==", UNIT_STATUS.AVAILABLE)
    .select("bloodGroup", "quantity", "consumedQuantity", "expiresAt")
    .get();
  const expired = snap.docs.filter((doc) => doc.get("expiresAt") < nowIso && !doc.get("consumedQuantity"));

  let discarded = 0;
  for (const doc of expired) {
    try {
      await discardUnit(doc.id, { reason: "expired" }, { label: "sweep-expired script" });
      discarded += 1;
    } catch (error) {
      if (error.status !== 400 && error.status !== 404) throw error; // someone else changed it meanwhile, skip it
    }
  }
  return { checked: snap.size, discarded };
};

/**
 * One-off repair tool (npm run migrate-units): the very first time units are introduced, every existing
 * "in" record predates them and has no `status`. Each is tagged `status: "legacy"` (kept for history,
 * never drawn from or discarded again), and, per organisation and blood group, one new "available" unit
 * is created holding the net balance those old records leave behind (the same figure the dashboard already
 * showed as available). It touches no running totals, since that blood was already counted when the old
 * records were created; it only makes the existing balance visible to the new, unit-based stock checks.
 * Safe to run more than once: an organisation and blood group that already has its opening-balance unit
 * is left untouched, even if some of that unit has since been issued or discarded.
 */
export const migrateLegacyRecordsToUnits = async () => {
  const now = new Date().toISOString();
  const snap = await inventoryCollection().get();
  const legacyIn = snap.docs.filter(
    (doc) => doc.get("inventoryType") === INVENTORY_TYPES.IN && !doc.get("status")
  );

  const balances = new Map(); // `${organisation}|${bloodGroup}` -> net ML, the old totalIn - totalOut method
  snap.docs.forEach((doc) => {
    const { organisation, bloodGroup, inventoryType, quantity } = doc.data();
    if (!organisation || !bloodGroup) return;
    const key = `${organisation}|${bloodGroup}`;
    const sign = inventoryType === INVENTORY_TYPES.IN ? 1 : -1;
    balances.set(key, (balances.get(key) || 0) + sign * quantity);
  });

  await Promise.all(legacyIn.map((doc) => doc.ref.update({ status: UNIT_STATUS.LEGACY, updatedAt: now })));

  let created = 0;
  for (const [key, balance] of balances) {
    if (balance <= 0) continue;
    const [organisation, bloodGroup] = key.split("|");
    const ref = inventoryCollection().doc(`legacy-${organisation}-${bloodGroup}`);

    if ((await ref.get()).exists) continue;
    const expiresAt = new Date(Date.parse(now) + env.SHELF_LIFE_DAYS * DAY_MS).toISOString();

    await ref.set({
      inventoryType: INVENTORY_TYPES.IN,
      bloodGroup,
      quantity: balance,
      organisation,
      phone: "",
      unitId: `OPEN-${bloodGroup}-${now.slice(0, 10).replace(/-/g, "")}`,
      status: UNIT_STATUS.AVAILABLE,
      consumedQuantity: 0,
      collectedAt: now,
      expiresAt,
      openingBalance: true,
      migrationNote: `Opening balance migrated from pre-unit records on ${now.slice(0, 10)}`,
      createdAt: now,
      updatedAt: now,
    });
    created += 1;
  }

  return { legacyRecordsTagged: legacyIn.length, openingBalanceUnitsCreated: created };
};
