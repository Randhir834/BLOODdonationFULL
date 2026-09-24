import { Router } from "express";
import { ROLE_LIST, ROLES } from "../constants/index.js";
import { bloodBanks, donors, hospitals, organisations } from "../controllers/directory.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requireRole } from "../middlewares/requireRole.js";

const router = Router();
router.use(authenticate);

router.get("/donors", requireRole(ROLES.ORGANISATION), donors);
router.get("/hospitals", requireRole(ROLES.ORGANISATION), hospitals);
router.get("/organisations", requireRole(ROLES.DONOR, ROLES.HOSPITAL), organisations);
// Every role can ask a blood bank for blood, so every role may see the list to pick from.
router.get("/blood-banks", requireRole(...ROLE_LIST), bloodBanks);

export default router;
