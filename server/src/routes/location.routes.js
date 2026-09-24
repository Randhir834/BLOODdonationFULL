import { Router } from "express";
import { ROLE_LIST } from "../constants/index.js";
import { events, nearby, setLocationSharing, update } from "../controllers/location.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requireRole } from "../middlewares/requireRole.js";
import { validate } from "../middlewares/validate.js";
import { locationSharingBody, updateLocationBody } from "../validators/location.validator.js";

const router = Router();
router.use(authenticate);

// Every role may share and see the map; a donor's own writes are still never exposed to anyone
// but an admin (see locationService.listNearbyPeople vs listForAdmin).
const canShare = requireRole(...ROLE_LIST);

router.patch("/", canShare, validate({ body: updateLocationBody }), update);
router.patch("/sharing", canShare, validate({ body: locationSharingBody }), setLocationSharing);
router.get("/nearby", nearby);
router.get("/events", events);

export default router;
