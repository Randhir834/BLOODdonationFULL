import { Router } from "express";
import { env } from "../config/env.js";
import { APPROVAL_ROLES } from "../constants/index.js";
import { phoneLogin } from "../controllers/auth.controller.js";
import * as notifications from "../controllers/org/notifications.controller.js";
import * as auth from "../controllers/org/auth.controller.js";
import * as overview from "../controllers/org/overview.controller.js";
import * as profile from "../controllers/org/profile.controller.js";
import * as reports from "../controllers/org/reports.controller.js";
import * as orgRequests from "../controllers/org/requests.controller.js";
import * as stock from "../controllers/org/stock.controller.js";
import { cancel, fulfil, reject, update as updateRequest } from "../controllers/request.controller.js";
import * as responses from "../controllers/response.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { rateLimiter } from "../middlewares/rateLimit.js";
import { requireOrgAccount } from "../middlewares/requireOrgAccount.js";
import { requireRole } from "../middlewares/requireRole.js";
import { validate } from "../middlewares/validate.js";
import { phoneLoginBody } from "../validators/auth.validator.js";
import { idParams } from "../validators/common.js";
import {
  activityQuery,
  discardBody,
  issueStockBody,
  movementsQuery,
  notificationParams,
  notificationsQuery,
  offerBody,
  orgProfileBody,
  orgRegisterBody,
  orgRequestsQuery,
  receiveStockBody,
  movementsReportQuery,
  requestsReportQuery,
  shipmentsQuery,
  unitsQuery,
  updateUnitBody,
} from "../validators/org.validator.js";
import {
  createRequestBody,
  rejectRequestBody,
  responseParams,
  updateRequestBody,
} from "../validators/request.validator.js";
import campRoutes from "./camp.routes.js";
import locationRoutes from "./location.routes.js";

/**
 * The hospital and blood bank website's API. Same accounts as the mobile app (a hospital or blood bank signs in
 * with the phone number it registered with), but its own door: only hospitals and blood banks pass, and it is
 * open only to the website's own origin.
 */
const router = Router();

// ---- Before an admin has approved the account ------------------------------------------------------------
router.post(
  "/auth/register",
  rateLimiter(20, 60 * 60 * 1000),
  authenticate,
  validate({ body: orgRegisterBody }),
  auth.register
);
router.get("/auth/me", authenticate, auth.me);

// DEVELOPMENT ONLY, same as the mobile app's: sign in with a phone number and no OTP.
if (env.ALLOW_PHONE_LOGIN) {
  router.post(
    "/auth/phone-login",
    rateLimiter(30, 15 * 60 * 1000),
    validate({ body: phoneLoginBody }),
    phoneLogin
  );
}

router.get("/profile", authenticate, requireOrgAccount, profile.get);
router.patch("/profile", authenticate, requireOrgAccount, validate({ body: orgProfileBody }), profile.update);
router.post("/profile/resubmit", authenticate, requireOrgAccount, profile.resubmit);

// ---- Approved hospitals and blood banks only --------------------------------------------------------------
router.use(authenticate, requireOrgAccount, requireRole(...APPROVAL_ROLES));

router.get("/dashboard", overview.dashboard);
router.get("/activity", validate({ query: activityQuery }), overview.activity);
router.get("/events", overview.events);

router.get("/notifications", validate({ query: notificationsQuery }), notifications.list);
router.post("/notifications/read-all", notifications.readAll);
router.post("/notifications/:id/read", validate({ params: notificationParams }), notifications.read);

// Stock: the same screens for both, hospitals keep their own stock apart from the blood banks'.
router.get("/stock", stock.summary);
router.get("/stock/units", validate({ query: unitsQuery }), stock.units);
router.get("/stock/units/:id", validate({ params: idParams }), stock.unit);
router.post("/stock/receive", validate({ body: receiveStockBody }), stock.receive);
router.post("/stock/issue", validate({ body: issueStockBody }), stock.issue);
router.patch("/stock/units/:id", validate({ params: idParams, body: updateUnitBody }), stock.update);
router.post("/stock/units/:id/discard", validate({ params: idParams, body: discardBody }), stock.discard);
router.get("/stock/movements", validate({ query: movementsQuery }), stock.movements);

// Hospitals: blood a blood bank issued to them, waiting for them to confirm it arrived.
router.get("/shipments", validate({ query: shipmentsQuery }), stock.shipments);
router.post("/shipments/:id/receive", validate({ params: idParams }), stock.receiveDelivery);

// Requests: one list for everything that concerns the organisation. The actions that only change a request's
// or an offer's state are the mobile app's own handlers, so both doors behave identically.
router.get("/requests", validate({ query: orgRequestsQuery }), orgRequests.list);
router.post("/requests", validate({ body: createRequestBody }), orgRequests.create);
router.get("/requests/:id", validate({ params: idParams }), orgRequests.detail);
router.patch("/requests/:id", validate({ params: idParams, body: updateRequestBody }), updateRequest);
router.post("/requests/:id/cancel", validate({ params: idParams }), cancel);
router.post("/requests/:id/fulfil", requireRole("organisation"), validate({ params: idParams }), fulfil);
router.post(
  "/requests/:id/reject",
  requireRole("organisation"),
  validate({ params: idParams, body: rejectRequestBody }),
  reject
);
router.post("/requests/:id/dismiss", validate({ params: idParams }), orgRequests.dismiss);
router.post("/requests/:id/restore", validate({ params: idParams }), orgRequests.restore);
router.post("/requests/:id/offer", validate({ params: idParams, body: offerBody }), orgRequests.offer);
router.get("/requests/:id/responses", validate({ params: idParams }), responses.list);
router.post(
  "/requests/:id/responses/:responseId/confirm",
  validate({ params: responseParams }),
  responses.confirm
);
router.post(
  "/requests/:id/responses/:responseId/decline",
  validate({ params: responseParams }),
  responses.decline
);
router.post(
  "/requests/:id/responses/:responseId/withdraw",
  validate({ params: responseParams }),
  responses.withdraw
);
router.post(
  "/requests/:id/responses/:responseId/dispatch",
  validate({ params: responseParams }),
  orgRequests.dispatch
);

router.get("/reports/movements.csv", validate({ query: movementsReportQuery }), reports.movementsCsv);
router.get("/reports/requests.csv", validate({ query: requestsReportQuery }), reports.requestsCsv);

// Blood camps (blood banks) and sharing a position on the nearby map are the mobile app's own routes.
router.use("/camps", campRoutes);
router.use("/location", locationRoutes);

export default router;
