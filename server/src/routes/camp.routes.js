import { Router } from "express";
import { ROLES } from "../constants/index.js";
import { create, mine, remove, update } from "../controllers/camp.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requireRole } from "../middlewares/requireRole.js";
import { validate } from "../middlewares/validate.js";
import { createCampBody, updateCampBody } from "../validators/camp.validator.js";
import { idParams } from "../validators/common.js";

// Everything here is for organisations (blood banks) managing the camps they run.
const router = Router();
router.use(authenticate, requireRole(ROLES.ORGANISATION));

router.post("/", validate({ body: createCampBody }), create);
router.get("/mine", mine);
router.patch("/:id", validate({ params: idParams, body: updateCampBody }), update);
router.delete("/:id", validate({ params: idParams }), remove);

export default router;
