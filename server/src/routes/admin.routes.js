import { Router } from "express";
import * as admins from "../controllers/admin/admins.controller.js";
import * as inventory from "../controllers/admin/inventory.controller.js";
import * as locations from "../controllers/admin/locations.controller.js";
import * as overview from "../controllers/admin/overview.controller.js";
import * as requests from "../controllers/admin/requests.controller.js";
import * as users from "../controllers/admin/users.controller.js";
import { authenticateAdmin } from "../middlewares/authenticateAdmin.js";
import { validate } from "../middlewares/validate.js";
import {
  auditLogsQuery,
  createAdminBody,
  dashboardQuery,
  listInventoryQuery,
  listRequestsQuery,
  listUsersQuery,
  rejectUserBody,
  suspendUserBody,
  updateUserBody,
} from "../validators/admin.validator.js";
import { idParams } from "../validators/common.js";

// Everything under /api/admin is for the separate admin website only.
// The mobile app never calls it and its users can not pass `authenticateAdmin`.
const router = Router();
router.use(authenticateAdmin);

router.get("/me", overview.me);
router.get("/dashboard", validate({ query: dashboardQuery }), overview.dashboard);
router.get("/system", overview.system);
router.get("/audit-logs", validate({ query: auditLogsQuery }), overview.auditLogs);
router.get("/events", overview.events);

router.get("/users", validate({ query: listUsersQuery }), users.list);
router.get("/users/:id", validate({ params: idParams }), users.detail);
router.patch("/users/:id", validate({ params: idParams, body: updateUserBody }), users.update);
router.post("/users/:id/suspend", validate({ params: idParams, body: suspendUserBody }), users.suspend);
router.post("/users/:id/reactivate", validate({ params: idParams }), users.reactivate);
router.post("/users/:id/approve", validate({ params: idParams }), users.approve);
router.post("/users/:id/reject", validate({ params: idParams, body: rejectUserBody }), users.reject);
router.delete("/users/:id", validate({ params: idParams }), users.remove);

router.get("/inventory", validate({ query: listInventoryQuery }), inventory.list);
router.delete("/inventory/:id", validate({ params: idParams }), inventory.remove);

router.get("/requests", validate({ query: listRequestsQuery }), requests.list);
router.get("/requests/:id/responses", validate({ params: idParams }), requests.responsesFor);

router.get("/admins", admins.list);
router.post("/admins", validate({ body: createAdminBody }), admins.create);
router.delete("/admins/:id", validate({ params: idParams }), admins.remove);

router.get("/locations", locations.list);
router.post("/camps/:id/suspend", validate({ params: idParams }), locations.suspendCamp);
router.post("/camps/:id/reactivate", validate({ params: idParams }), locations.reactivateCamp);
router.delete("/camps/:id", validate({ params: idParams }), locations.removeCamp);

export default router;
