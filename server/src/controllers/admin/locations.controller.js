import { CAMP_STATUS } from "../../constants/index.js";
import * as audit from "../../services/auditService.js";
import { adminRemoveCamp, listAllCamps, setCampStatus } from "../../services/campService.js";
import { listForAdmin } from "../../services/locationService.js";

const campTarget = (camp) => ({ type: "camp", id: camp._id, label: camp.name });

// GET /locations: every donor, hospital and blood bank sharing their location, plus every camp
// (including ones an admin has suspended) — the data behind the centralized map.
export const list = async (_req, res) => {
  const [people, camps] = await Promise.all([listForAdmin(), listAllCamps()]);
  res.json({ success: true, people, camps });
};

// POST /camps/:id/suspend: hides a camp from every other user's "nearby" map
export const suspendCamp = async (req, res) => {
  const camp = await setCampStatus(req.validated.params.id, CAMP_STATUS.SUSPENDED);
  await audit.record(req.admin, "camp.suspend", campTarget(camp));
  res.json({ success: true, camp });
};

// POST /camps/:id/reactivate
export const reactivateCamp = async (req, res) => {
  const camp = await setCampStatus(req.validated.params.id, CAMP_STATUS.ACTIVE);
  await audit.record(req.admin, "camp.reactivate", campTarget(camp));
  res.json({ success: true, camp });
};

// DELETE /camps/:id
export const removeCamp = async (req, res) => {
  const camp = await adminRemoveCamp(req.validated.params.id);
  await audit.record(req.admin, "camp.delete", campTarget(camp));
  res.json({ success: true, message: "Camp deleted" });
};
