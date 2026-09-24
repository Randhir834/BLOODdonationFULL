import { Router } from "express";
import { ROLES } from "../constants/index.js";
import { overview, stock } from "../controllers/analytics.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requireRole } from "../middlewares/requireRole.js";
import { validate } from "../middlewares/validate.js";
import { overviewQuery } from "../validators/inventory.validator.js";

const router = Router();

router.get("/stock", authenticate, requireRole(ROLES.ORGANISATION), stock);
router.get("/overview", authenticate, requireRole(ROLES.ORGANISATION), validate({ query: overviewQuery }), overview);

export default router;
