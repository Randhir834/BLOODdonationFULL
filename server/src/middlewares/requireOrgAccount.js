import { APPROVAL_ROLES, USER_STATUS } from "../constants/index.js";
import { HttpError } from "../utils/HttpError.js";
import { sessionUsers } from "../services/sessionCache.js";
import { findUserById } from "../services/userService.js";

/**
 * The hospital / blood bank website's own sign-in check, for the few routes an organisation may use before an
 * admin has approved it (its profile, and sending a refused registration for review again). Everything else
 * uses `requireRole(HOSPITAL, ORGANISATION)`, which also insists on approval. Donors are refused: this website
 * is not for them. Sets `req.user`. Must run after `authenticate`.
 */
export const requireOrgAccount = async (req, _res, next) => {
  const user = await sessionUsers.get(req.auth.uid, () => findUserById(req.auth.uid));
  if (!user) throw new HttpError(404, "This account is not set up yet");
  if (!APPROVAL_ROLES.includes(user.role)) {
    throw new HttpError(403, "This website is for hospitals and blood banks. Donors use the mobile app.");
  }
  if (user.status === USER_STATUS.SUSPENDED) throw new HttpError(403, "Your account is suspended");
  req.user = user;
  next();
};
