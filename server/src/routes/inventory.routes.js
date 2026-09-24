import { Router } from "express";
import { ROLES } from "../constants/index.js";
import { create, discard, list, mine } from "../controllers/inventory.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requireRole } from "../middlewares/requireRole.js";
import { validate } from "../middlewares/validate.js";
import { idParams } from "../validators/common.js";
import { createRecordBody, discardUnitBody, myRecordsQuery } from "../validators/inventory.validator.js";

const router = Router();
router.use(authenticate);

router.post("/", requireRole(ROLES.ORGANISATION), validate({ body: createRecordBody }), create);
router.post(
  "/:id/discard",
  requireRole(ROLES.ORGANISATION),
  validate({ params: idParams, body: discardUnitBody }),
  discard
);
router.get("/", requireRole(ROLES.ORGANISATION), list);
router.get("/mine", requireRole(ROLES.DONOR, ROLES.HOSPITAL), validate({ query: myRecordsQuery }), mine);

export default router;
