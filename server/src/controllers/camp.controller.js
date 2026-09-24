import * as audit from "../services/auditService.js";
import { createCamp, listMine, removeCamp, updateCamp } from "../services/campService.js";

const target = (camp) => ({ type: "camp", id: camp._id, label: camp.name });

// POST /camps (organisations): registers a camp at a fixed venue
export const create = async (req, res) => {
  const camp = await createCamp(req.user, req.validated.body);
  await audit.recordActivity(req.user, "camp.create", target(camp));
  res.status(201).json({ success: true, camp });
};

// GET /camps/mine (organisations): every camp this blood bank runs
export const mine = async (req, res) => {
  res.json({ success: true, camps: await listMine(req.user._id) });
};

// PATCH /camps/:id (organisations): edits a camp they own
export const update = async (req, res) => {
  const camp = await updateCamp(req.validated.params.id, req.user._id, req.validated.body);
  await audit.recordActivity(req.user, "camp.update", target(camp));
  res.json({ success: true, camp });
};

// DELETE /camps/:id (organisations): removes a camp they own
export const remove = async (req, res) => {
  const camp = await removeCamp(req.validated.params.id, req.user._id);
  await audit.recordActivity(req.user, "camp.remove", target(camp));
  res.json({ success: true, message: "Camp deleted" });
};
