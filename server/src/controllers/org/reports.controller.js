import { listOrgRequests } from "../../services/orgRequestService.js";
import { listMovements } from "../../services/orgStockService.js";
import { displayName } from "../../services/userService.js";
import { toCsv } from "../../utils/csv.js";
import { dayKey } from "../../utils/time.js";

const KIND_LABEL = { received: "Received", issued: "Issued", discarded: "Discarded" };

const send = (res, name, rows) => {
  res.set("Content-Type", "text/csv; charset=utf-8");
  res.set("Content-Disposition", `attachment; filename="${name}-${dayKey(new Date())}.csv"`);
  res.send(toCsv(rows));
};

// GET /org/reports/movements.csv?from=&to=: every movement of blood in the period
export const movementsCsv = async (req, res) => {
  const { movements } = await listMovements(req.user, req.validated.query);
  send(res, "blood-movements", [
    [
      "Date and time (UTC)",
      "Type",
      "Unit",
      "Blood group",
      "Quantity (ML)",
      "From / to",
      "Phone",
      "Reference",
      "Reason",
      "Note",
    ],
    ...movements.map((m) => [
      m.at,
      KIND_LABEL[m.kind],
      m.unitId ?? "",
      m.bloodGroup,
      m.quantity,
      m.counterpartName ?? "",
      m.phone,
      m.reference ?? "",
      m.reason ?? "",
      m.note ?? "",
    ]),
  ]);
};

// GET /org/reports/requests.csv?from=&to=: every request the organisation is involved in
export const requestsCsv = async (req, res) => {
  const { needsAction, dismissed, ...filters } = req.validated.query;
  const { requests } = await listOrgRequests(req.user, {
    ...filters,
    needsAction: Boolean(needsAction),
    dismissed: Boolean(dismissed),
    sort: "newest",
  });
  send(res, "blood-requests", [
    [
      "Raised (UTC)",
      "Blood group",
      "Quantity (ML)",
      "Priority",
      "Status",
      "Patient",
      "Location",
      "City",
      "Raised by",
      "Relation",
      "Needed by (UTC)",
    ],
    ...requests.map((r) => [
      r.createdAt,
      r.bloodGroup,
      r.quantity,
      r.priority,
      r.expired ? "expired" : r.status,
      r.patientName,
      r.location,
      r.city ?? "",
      r.requester ? displayName(r.requester) : "",
      r.relation,
      r.requiredAt ?? "",
    ]),
  ]);
};
