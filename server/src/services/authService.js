import { getAdminAuth } from "../config/firebase.js";
import { HttpError } from "../utils/HttpError.js";

/**
 * DEVELOPMENT ONLY (see ALLOW_PHONE_LOGIN): a Firebase custom token for a phone number, with no OTP.
 * It uses the same Firebase account, and so the same profile, as the OTP sign-in for that number.
 */
export const customTokenForPhone = async (phone) => {
  const auth = getAdminAuth();
  const account = await auth.getUserByPhoneNumber(phone).catch((error) => {
    if (error.code !== "auth/user-not-found") throw error;
    return auth.createUser({ phoneNumber: phone }).catch((createError) => {
      // Two requests for the same new number arrived close together (e.g. a double-tap): the other one
      // created the account a moment ago. Fetch it instead of failing this request.
      if (createError.code === "auth/phone-number-already-exists") return auth.getUserByPhoneNumber(phone);
      throw createError;
    });
  });
  if (account.disabled) throw new HttpError(403, "This account has been suspended.");
  return auth.createCustomToken(account.uid);
};
