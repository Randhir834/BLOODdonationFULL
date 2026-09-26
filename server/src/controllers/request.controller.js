import * as audit from "../services/auditService.js";
import * as notifications from "../services/notificationService.js";
import { populate } from "../services/inventoryService.js";
import {
  cancelRequest,
  createRequest,
  editRequest,
  findRequestById,
  fulfilRequest,
  listNearbyRequests,
  listRequests,
  rejectRequest,
} from "../services/requestService.js";
import { findOwnResponse, handleCancelledRequest } from "../services/responseService.js";
import { HttpError } from "../utils/HttpError.js";

const target = (request) => ({
  type: "request",
  id: request._id,
  label: `${request.quantity} ML ${request.bloodGroup}`,
});

const findOr404 = async (id) => {
  const request = await findRequestById(id);
  if (!request) throw new HttpError(404, "Request not found");
  return request;
};

// POST /requests: any signed-in donor, hospital or blood bank raises a request, broadcast to their city
export const create = async (req, res) => {
  const request = await createRequest(req.user, req.validated.body);
  await audit.recordActivity(req.user, "request.create", target(request), {
    organisation: request.organisation,
    city: request.city,
    priority: request.priority,
  });
  await notifications.notifyNewRequest(request);
  res.status(201).json({ success: true, request });
};

// PATCH /requests/:id: the requester edits their own request while it is still pending
export const update = async (req, res) => {
  const before = await findOr404(req.validated.params.id);
  const request = await editRequest(before, req.user, req.validated.body);
  await audit.recordActivity(req.user, "request.update", target(request));
  res.json({ success: true, request });
};

// GET /requests?status= (blood banks): every request naming this blood bank, with the requester's name
export const list = async (req, res) => {
  const requests = await listRequests("organisation", req.user._id, req.validated.query.status);
  res.json({ success: true, requests: await populate(requests, ["requester"]) });
};

// GET /requests/mine?status= : the signed-in user's own requests, with the blood bank's name
export const mine = async (req, res) => {
  const requests = await listRequests("requester", req.user._id, req.validated.query.status);
  res.json({ success: true, requests: await populate(requests, ["organisation"]) });
};

// GET /requests/nearby?status= : other people's pending requests from the signed-in user's own city,
// with the requester's name filled in — the discovery feed every role browses to respond to a request.
export const nearby = async (req, res) => {
  const requests = await listNearbyRequests(req.user.cityKey, req.user._id, req.validated.query.status);
  res.json({ success: true, requests: await populate(requests, ["requester", "organisation"]) });
};

// GET /requests/:id: any signed-in user may view one request (e.g. opened from a notification), with
// the requester's and blood bank's names filled in, and their own response to it, if they have made one
export const detail = async (req, res) => {
  const request = await findOr404(req.validated.params.id);
  const [populated] = await populate([request], ["requester", "organisation"]);
  const myResponse = await findOwnResponse(request._id, req.user._id);
  res.json({ success: true, request: populated, myResponse });
};

// POST /requests/:id/fulfil (blood banks): issues the blood now, the same way as a normal issue
export const fulfil = async (req, res) => {
  const before = await findOr404(req.validated.params.id);
  const request = await fulfilRequest(before, req.user._id);
  await audit.recordActivity(req.user, "request.fulfil", target(request), {
    fulfilledRecordId: request.fulfilledRecordId,
  });
  await notifications.notifyRequestUpdate(request, [request.requester], "Your blood request was fulfilled");
  res.json({ success: true, request });
};

// POST /requests/:id/reject  { reason } (blood banks)
export const reject = async (req, res) => {
  const before = await findOr404(req.validated.params.id);
  const { reason } = req.validated.body;
  const request = await rejectRequest(before, req.user._id, reason);
  await audit.recordActivity(req.user, "request.reject", target(request), { reason });
  await notifications.notifyRequestUpdate(request, [request.requester], `Your blood request was rejected: ${reason}`);
  res.json({ success: true, request });
};

// POST /requests/:id/cancel: the requester withdraws their own request while it is still pending
export const cancel = async (req, res) => {
  const before = await findOr404(req.validated.params.id);
  const request = await cancelRequest(before, req.user._id);
  // Before the open offers are declined, so the people who made them can still be found.
  await notifications.notifyRequestCancelled(request);
  await handleCancelledRequest(request);
  await audit.recordActivity(req.user, "request.cancel", target(request));
  res.json({ success: true, request });
};
