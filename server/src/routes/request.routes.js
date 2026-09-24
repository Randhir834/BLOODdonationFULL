import { Router } from "express";
import { ROLE_LIST, ROLES } from "../constants/index.js";
import {
  cancel,
  create,
  detail,
  fulfil,
  list,
  mine,
  nearby,
  reject,
  update,
} from "../controllers/request.controller.js";
import * as responses from "../controllers/response.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requireRole } from "../middlewares/requireRole.js";
import { validate } from "../middlewares/validate.js";
import { idParams } from "../validators/common.js";
import {
  createRequestBody,
  listRequestsQuery,
  rejectRequestBody,
  respondToRequestBody,
  responseParams,
  updateRequestBody,
} from "../validators/request.validator.js";

const router = Router();
router.use(authenticate);

// Any donor, hospital or blood bank may raise a request (broadcast to their own city) and manage its
// own requests. Only a blood bank sees and answers the (legacy, optional) requests naming it directly
// (list, fulfil, reject).
router.post("/", requireRole(...ROLE_LIST), validate({ body: createRequestBody }), create);
router.get("/", requireRole(ROLES.ORGANISATION), validate({ query: listRequestsQuery }), list);
router.get("/mine", requireRole(...ROLE_LIST), validate({ query: listRequestsQuery }), mine);
router.get("/nearby", requireRole(...ROLE_LIST), validate({ query: listRequestsQuery }), nearby);
// Any signed-in user may view one request by id, e.g. opened from a notification link.
router.get("/:id", requireRole(...ROLE_LIST), validate({ params: idParams }), detail);
router.patch("/:id", requireRole(...ROLE_LIST), validate({ params: idParams, body: updateRequestBody }), update);
router.post("/:id/fulfil", requireRole(ROLES.ORGANISATION), validate({ params: idParams }), fulfil);
router.post(
  "/:id/reject",
  requireRole(ROLES.ORGANISATION),
  validate({ params: idParams, body: rejectRequestBody }),
  reject
);
router.post("/:id/cancel", requireRole(...ROLE_LIST), validate({ params: idParams }), cancel);

// Any role may respond to someone else's request, offering some number of units. Only the requester
// sees the full response list and confirms/declines; a responder may withdraw their own pending offer.
router.post(
  "/:id/respond",
  requireRole(...ROLE_LIST),
  validate({ params: idParams, body: respondToRequestBody }),
  responses.create
);
router.get("/:id/responses", requireRole(...ROLE_LIST), validate({ params: idParams }), responses.list);
router.post(
  "/:id/responses/:responseId/confirm",
  requireRole(...ROLE_LIST),
  validate({ params: responseParams }),
  responses.confirm
);
router.post(
  "/:id/responses/:responseId/decline",
  requireRole(...ROLE_LIST),
  validate({ params: responseParams }),
  responses.decline
);
router.post(
  "/:id/responses/:responseId/withdraw",
  requireRole(...ROLE_LIST),
  validate({ params: responseParams }),
  responses.withdraw
);

export default router;
