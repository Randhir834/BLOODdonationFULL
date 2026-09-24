import { HttpError } from "../utils/HttpError.js";
import { bearerToken } from "../utils/bearerToken.js";
import { phoneNumberOf, verifyIdToken } from "../services/tokenService.js";

/**
 * Mobile app users: verifies the Firebase ID token and requires a verified phone number.
 * Sets `req.auth = { uid, phone }`. Admin accounts have no phone number, so they are refused here.
 */
export const authenticate = async (req, _res, next) => {
  const token = bearerToken(req);
  if (!token) throw new HttpError(401, "Authentication required");

  const decoded = await verifyIdToken(token);
  // Sessions created with a custom token (development sign-in) may not carry the claim.
  const phone = decoded.phone_number ?? (await phoneNumberOf(decoded.uid));
  if (!phone) throw new HttpError(401, "This account has no verified phone number");

  req.auth = { uid: decoded.uid, phone };
  next();
};
