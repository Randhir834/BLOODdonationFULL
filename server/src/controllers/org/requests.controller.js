import { STANDARD_UNIT_ML } from "../../constants/index.js";
import * as audit from "../../services/auditService.js";
import * as notifications from "../../services/notificationService.js";
import {
  availableMl,
  dispatchResponse,
  getOrgRequest,
  listOrgRequests,
  requireStockFor,
  setDismissed,
} from "../../services/orgRequestService.js";
import { findRequestById } from "../../services/requestService.js";
import { createResponse, findResponseById } from "../../services/responseService.js";
import { HttpError } from "../../utils/HttpError.js";
import { paginate } from "../../utils/pagination.js";
import { create as createRequest } from "../request.controller.js";

const target = (request) => ({
  type: "request",
  id: request._id,
  label: `${request.quantity} ML ${request.bloodGroup}`,
});

// GET /org/requests?relation=&status=&bloodGroup=&priority=&needsAction=&dismissed=&sort=&q=&from=&to=&page=&pageSize=
export const list = async (req, res) => {
  const { page, pageSize, needsAction, dismissed, ...filters } = req.validated.query;
  const result = await listOrgRequests(req.user, {
    ...filters,
    needsAction: Boolean(needsAction),
    dismissed: Boolean(dismissed),
  });
  const rows = paginate(result.requests, page, pageSize);
  res.json({
    success: true,
    total: rows.total,
    page,
    pageSize,
    truncated: result.truncated,
    stats: result.stats,
    requests: rows.rows,
  });
};

// GET /org/requests/:id
export const detail = async (req, res) => {
  res.json({ success: true, ...(await getOrgRequest(req.user, req.validated.params.id)) });
};

// POST /org/requests: raise a request. It is shown to the organisation's own city, so it needs one.
export const create = async (req, res, next) => {
  if (!req.user.city) {
    throw new HttpError(
      400,
      "Add your city on the Profile page first, requests are shown to people in your city"
    );
  }
  return createRequest(req, res, next);
};

// POST /org/requests/:id/offer { unitsOffered }: "we can help", checked against the organisation's own stock
export const offer = async (req, res) => {
  const request = await findRequestById(req.validated.params.id);
  if (!request) throw new HttpError(404, "Request not found");
  if (request.requester === req.user._id) throw new HttpError(400, "You can not respond to your own request");
  // Being able to see the request at all is what allows answering it.
  await getOrgRequest(req.user, request._id);
  const { unitsOffered } = req.validated.body;
  await requireStockFor(req.user, request.bloodGroup, unitsOffered * STANDARD_UNIT_ML);

  const response = await createResponse(request, req.user, unitsOffered);
  await audit.recordActivity(
    req.user,
    "response.create",
    { type: "response", id: response._id, label: `${response.unitsOffered} unit(s)` },
    { requestId: request._id }
  );
  await notifications.notifyResponse(request, response, req.user);
  res.status(201).json({ success: true, response });
};

// POST /org/requests/:id/responses/:responseId/dispatch: issue blood from stock for a confirmed offer
export const dispatch = async (req, res) => {
  const { id, responseId } = req.validated.params;
  const request = await findRequestById(id);
  const response = await findResponseById(responseId);
  if (!request || !response) throw new HttpError(404, "Offer not found");

  const result = await dispatchResponse(request, response, req.user);
  await audit.recordActivity(req.user, "request.dispatch", target(request), {
    quantity: result.quantity,
    recordId: result.record._id,
  });
  await notifications.notifyDispatched(request, req.user, result.quantity);
  try {
    await notifications.notifyIfLowStock(
      req.user,
      request.bloodGroup,
      result.quantity,
      await availableMl(req.user, request.bloodGroup)
    );
  } catch {
    // an alert that could not be worked out never fails the action that caused it
  }
  res.json({ success: true, response: result.response, record: result.record });
};

// POST /org/requests/:id/dismiss and /restore: hide or show someone else's request in this organisation's list
export const dismiss = async (req, res) => {
  await setDismissed(req.user, req.validated.params.id, true);
  res.json({ success: true });
};

export const restore = async (req, res) => {
  await setDismissed(req.user, req.validated.params.id, false);
  res.json({ success: true });
};
