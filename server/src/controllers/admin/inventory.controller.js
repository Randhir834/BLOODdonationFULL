import * as audit from "../../services/auditService.js";
import { deleteRecord, listRecords, populate } from "../../services/inventoryService.js";
import { HttpError } from "../../utils/HttpError.js";
import { paginate } from "../../utils/pagination.js";
import { dayKey } from "../../utils/time.js";

// GET /inventory?type=&bloodGroup=&organisation=&q=&from=&to=&status=&sort=&page=&pageSize=
export const list = async (req, res) => {
  const { type, bloodGroup, organisation, q, from, to, status, sort, page, pageSize } = req.validated.query;
  const { records, truncated } = await listRecords({ inventoryType: type, bloodGroup, organisation });

  const nowIso = new Date().toISOString();
  // The day range, phone search and unit status run in memory. Days are read in the admin time zone.
  let rows = records.filter((record) => {
    const day = dayKey(new Date(record.createdAt));
    if (from && day < from) return false;
    if (to && day > to) return false;
    if (status === "expired" && !(record.status === "available" && record.expiresAt < nowIso)) return false;
    if (status && status !== "expired" && record.status !== status) return false;
    return !q || String(record.phone || "").includes(q);
  });
  if (sort === "expiry") {
    rows = [...rows].sort((a, b) => (a.expiresAt || "9999").localeCompare(b.expiresAt || "9999"));
  }

  const result = paginate(rows, page, pageSize);
  res.json({
    success: true,
    total: result.total,
    page,
    pageSize,
    truncated,
    records: await populate(result.rows, ["donar", "hospital", "organisation"]),
  });
};

// DELETE /inventory/:id: the running stock totals are corrected in the same transaction
export const remove = async (req, res) => {
  const record = await deleteRecord(req.validated.params.id);
  if (!record) throw new HttpError(404, "Record not found");

  await audit.record(
    req.admin,
    "inventory.delete",
    {
      type: "inventory",
      id: record._id,
      label: `${record.inventoryType.toUpperCase()} ${record.quantity} ML ${record.bloodGroup}`,
    },
    {
      inventoryType: record.inventoryType,
      bloodGroup: record.bloodGroup,
      quantity: record.quantity,
      phone: record.phone,
      organisation: record.organisation,
      createdAt: record.createdAt,
    }
  );
  res.json({ success: true, message: "Record deleted" });
};
