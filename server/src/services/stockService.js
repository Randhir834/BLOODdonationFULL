import { FieldValue } from "firebase-admin/firestore";
import { BLOOD_GROUPS, INVENTORY_TYPES } from "../constants/index.js";
import { inventoryCollection, stockStatsRef } from "./collections.js";

/**
 * Running totals per blood group. They are changed in the same transaction as every record that is
 * created or deleted, so the dashboard never has to add up every record.
 * `sign` is 1 when a record is created and -1 when it is deleted.
 */
export const bumpStock = (tx, record, sign) =>
  tx.set(
    stockStatsRef(),
    { [record.bloodGroup]: { [record.inventoryType]: FieldValue.increment(sign * record.quantity) } },
    { merge: true }
  );

/** Same running totals, for blood thrown away rather than issued (discarded units, see inventoryService). */
export const bumpDiscarded = (tx, bloodGroup, quantity, sign = 1) =>
  tx.set(
    stockStatsRef(),
    { [bloodGroup]: { discarded: FieldValue.increment(sign * quantity) } },
    { merge: true }
  );

/**
 * [{ bloodGroup, totalIn, totalOut, totalDiscarded, available }] for every blood group, across all
 * organisations. `available` treats every group fairly: what was added, minus what left (issued or
 * discarded). It is a fast, approximate figure; it does not know about units that have quietly expired
 * but have not been discarded yet (see `npm run sweep-expired`), unlike a blood bank's own stock page.
 */
export const stockTotals = async () => {
  const data = (await stockStatsRef().get()).data() || {};
  return BLOOD_GROUPS.map((bloodGroup) => {
    const totalIn = data[bloodGroup]?.in || 0;
    const totalOut = data[bloodGroup]?.out || 0;
    const totalDiscarded = data[bloodGroup]?.discarded || 0;
    return { bloodGroup, totalIn, totalOut, totalDiscarded, available: totalIn - totalOut - totalDiscarded };
  });
};

/**
 * Recomputes the running totals from every record (repair tool: npm run rebuild-stock).
 * An opening-balance unit (see inventoryService.migrateLegacyRecordsToUnits) is left out of `in`: it is
 * not new blood, it is the pre-migration balance repackaged into a unit, already counted once by the
 * legacy records it was computed from. If it is later discarded, that still counts toward `discarded`.
 */
export const rebuildStock = async () => {
  const snap = await inventoryCollection()
    .select("bloodGroup", "inventoryType", "quantity", "status", "openingBalance")
    .get();
  const totals = Object.fromEntries(BLOOD_GROUPS.map((group) => [group, { in: 0, out: 0, discarded: 0 }]));
  snap.docs.forEach((doc) => {
    const { bloodGroup, inventoryType, quantity, status, openingBalance } = doc.data();
    if (!totals[bloodGroup] || !(inventoryType in totals[bloodGroup])) return;
    if (!(inventoryType === "in" && openingBalance)) totals[bloodGroup][inventoryType] += quantity;
    if (inventoryType === "in" && status === "discarded") totals[bloodGroup].discarded += quantity;
  });
  await stockStatsRef().set(totals);
  return { records: snap.size, totals };
};

/** Total blood in and out of one group, from a list of records. */
export const sumQuantity = (records, inventoryType) =>
  records
    .filter((record) => record.inventoryType === inventoryType)
    .reduce((total, record) => total + record.quantity, 0);

/** { [bloodGroup]: { totalIn, totalOut } } for the given records of one organisation. */
export const totalsByBloodGroup = (records) => {
  const totals = Object.fromEntries(BLOOD_GROUPS.map((group) => [group, { totalIn: 0, totalOut: 0 }]));
  records.forEach(({ bloodGroup, inventoryType, quantity }) => {
    if (!totals[bloodGroup]) return;
    totals[bloodGroup][inventoryType === INVENTORY_TYPES.IN ? "totalIn" : "totalOut"] += quantity;
  });
  return totals;
};
