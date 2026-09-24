import { populate } from "../../services/inventoryService.js";
import { findRequestById, listAllRequests } from "../../services/requestService.js";
import { listResponsesForRequest } from "../../services/responseService.js";
import { HttpError } from "../../utils/HttpError.js";
import { paginate } from "../../utils/pagination.js";

// GET /requests?status=&role=&bloodGroup=&organisation=&q=&page=&pageSize=
// Every blood request in the system, whoever created it: donor, hospital or blood bank.
export const list = async (req, res) => {
  const { status, role, bloodGroup, organisation, q, page, pageSize } = req.validated.query;
  const { requests, truncated } = await listAllRequests();

  const needle = q?.toLowerCase();
  const rows = requests.filter((r) => {
    if (status && r.status !== status) return false;
    if (role && r.requesterRole !== role) return false;
    if (bloodGroup && r.bloodGroup !== bloodGroup) return false;
    if (organisation && r.organisation !== organisation) return false;
    if (!needle) return true;
    return (
      String(r.patientName || "").toLowerCase().includes(needle) ||
      String(r.requesterPhone || "").includes(q) ||
      String(r.contactPhone || "").includes(q) ||
      String(r.location || "").toLowerCase().includes(needle)
    );
  });

  const result = paginate(rows, page, pageSize);
  res.json({
    success: true,
    total: result.total,
    page,
    pageSize,
    truncated,
    requests: await populate(result.rows, ["requester", "organisation"]),
  });
};

// GET /requests/:id/responses: every response to one request, whoever it was made by
export const responsesFor = async (req, res) => {
  const request = await findRequestById(req.validated.params.id);
  if (!request) throw new HttpError(404, "Request not found");
  const responseList = await listResponsesForRequest(request._id);
  res.json({ success: true, responses: await populate(responseList, ["responderId"]) });
};
