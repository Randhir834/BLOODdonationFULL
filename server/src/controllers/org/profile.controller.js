import * as audit from "../../services/auditService.js";
import { displayName, resubmitForReview, updateOrgProfile } from "../../services/userService.js";

const target = (user) => ({ type: "user", id: user._id, label: displayName(user) });

// GET /org/profile
export const get = (req, res) => {
  res.json({ success: true, user: req.user });
};

// PATCH /org/profile: the organisation edits its own details
export const update = async (req, res) => {
  const user = await updateOrgProfile(req.user, req.validated.body);
  await audit.recordActivity(user, "user.update-profile", target(user), {
    fields: Object.keys(req.validated.body),
  });
  res.json({ success: true, user });
};

// POST /org/profile/resubmit: a refused registration goes back for review
export const resubmit = async (req, res) => {
  const user = await resubmitForReview(req.user);
  await audit.recordActivity(user, "user.resubmit", target(user));
  res.json({ success: true, user });
};
