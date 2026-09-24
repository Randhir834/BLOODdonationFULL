import { HttpError } from "../utils/HttpError.js";
import { bearerToken } from "../utils/bearerToken.js";
import { verifyIdToken } from "../services/tokenService.js";

/**
 * Admin website only: the Firebase account must carry the `admin` claim (set by the create-admin
 * script or by another admin). Phone-number users of the mobile app can never get this claim.
 * Sets `req.admin = { uid, email }`.
 */
export const authenticateAdmin = async (req, _res, next) => {
  const token = bearerToken(req);
  if (!token) throw new HttpError(401, "Authentication required");

  const decoded = await verifyIdToken(token);
  if (decoded.admin !== true || !decoded.email) throw new HttpError(403, "This account is not an admin");

  req.admin = { uid: decoded.uid, email: decoded.email };
  next();
};
