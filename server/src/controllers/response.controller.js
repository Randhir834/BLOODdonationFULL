import * as audit from "../services/auditService.js";
import * as notifications from "../services/notificationService.js";
import { populate } from "../services/inventoryService.js";
import { findRequestById } from "../services/requestService.js";
import {
  confirmResponse,
  createResponse,
  declineResponse,
  findResponseById,
  listResponsesForRequest,
  withdrawResponse,
} from "../services/responseService.js";
import { HttpError } from "../utils/HttpError.js";

const findRequestOr404 = async (id) => {
  const request = await findRequestById(id);
  if (!request) throw new HttpError(404, "Request not found");
  return request;
};

const findResponseOr404 = async (id) => {
  const response = await findResponseById(id);
  if (!response) throw new HttpError(404, "Response not found");
  return response;
};

const target = (response) => ({
  type: "response",
  id: response._id,
  label: `${response.unitsOffered} unit(s)`,
});

// POST /requests/:id/respond: a donor, hospital or blood bank offers units against someone else's request
export const create = async (req, res) => {
  const request = await findRequestOr404(req.validated.params.id);
  const response = await createResponse(request, req.user, req.validated.body.unitsOffered);
  await audit.recordActivity(req.user, "response.create", target(response), { requestId: request._id });
  await notifications.notifyResponse(request, response, req.user);
  res.status(201).json({ success: true, response });
};

// GET /requests/:id/responses: the requester's own view of who has responded, with their names filled in
export const list = async (req, res) => {
  const request = await findRequestOr404(req.validated.params.id);
  if (request.requester !== req.user._id) throw new HttpError(404, "Request not found");
  const responses = await listResponsesForRequest(request._id);
  res.json({ success: true, responses: await populate(responses, ["responderId"]) });
};

// POST /requests/:id/responses/:responseId/confirm: the requester accepts one response
export const confirm = async (req, res) => {
  const request = await findRequestOr404(req.validated.params.id);
  const response = await findResponseOr404(req.validated.params.responseId);
  const result = await confirmResponse(request, response, req.user._id);
  await audit.recordActivity(req.user, "response.confirm", target(result.response), {
    requestId: request._id,
    unitsApplied: result.response.unitsApplied,
  });
  await notifications.notifyResponseDecision(result.request, result.response, "confirmed");
  res.json({ success: true, request: result.request, response: result.response });
};

// POST /requests/:id/responses/:responseId/decline: the requester turns one response down
export const decline = async (req, res) => {
  const request = await findRequestOr404(req.validated.params.id);
  const response = await findResponseOr404(req.validated.params.responseId);
  const updated = await declineResponse(request, response, req.user._id);
  await audit.recordActivity(req.user, "response.decline", target(updated), { requestId: request._id });
  await notifications.notifyResponseDecision(request, updated, "declined");
  res.json({ success: true, response: updated });
};

// POST /requests/:id/responses/:responseId/withdraw: the responder pulls back their own pending offer
export const withdraw = async (req, res) => {
  const response = await findResponseOr404(req.validated.params.responseId);
  const updated = await withdrawResponse(response, req.user._id);
  await audit.recordActivity(req.user, "response.withdraw", target(updated), { requestId: response.requestId });
  res.json({ success: true, response: updated });
};
