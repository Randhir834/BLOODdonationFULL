import { USER_STATUS, VERIFICATION } from "../constants/index.js";
import { HttpError } from "../utils/HttpError.js";
import { sessionUsers } from "../services/sessionCache.js";
import { findUserById, isApproved, verificationOf } from "../services/userService.js";

/**
 * Allows the request only when the signed-in user has one of the given roles, is not suspended and,
 * for hospitals and blood banks, has been approved by an admin. Must run after `authenticate`.
 * Sets `req.user` to the user's profile.
 */
export const requireRole =
  (...roles) =>
  async (req, _res, next) => {
    const user = await sessionUsers.get(req.auth.uid, () => findUserById(req.auth.uid));
    if (!user || !roles.includes(user.role)) throw new HttpError(403, "Access denied");
    if (user.status === USER_STATUS.SUSPENDED) throw new HttpError(403, "Your account is suspended");
    if (!isApproved(user)) {
      throw new HttpError(
        403,
        verificationOf(user) === VERIFICATION.REJECTED
          ? "Your registration was not approved"
          : "Your account is waiting for admin approval"
      );
    }
    req.user = user;
    next();
  };
