import { env } from "../config/env.js";
import { getAdminAuth } from "../config/firebase.js";
import { HttpError } from "../utils/HttpError.js";
import { createTtlCache } from "../utils/ttlCache.js";

const SESSION_EXPIRED = "Your session has expired, please sign in again";

// A problem with the token or the account (expired, revoked, disabled, malformed) versus a problem
// with Firebase itself (network, credentials), which must not look like "signed out" to the apps.
const isCredentialProblem = (error) =>
  typeof error?.code === "string" && error.code.startsWith("auth/") && error.code !== "auth/internal-error";

/**
 * Builds a verifier that checks a Firebase ID token, also rejecting revoked tokens and disabled or
 * deleted accounts. Checking for revocation is a network call to Firebase, and a screen load makes
 * several requests with the same token at once, so a successful check is reused for `ttlMs` (and shared
 * between requests in flight together). A token's own expiry is always honoured. The trade-off: a token
 * revoked in the last `ttlMs` still passes this check, but a suspended or deleted user is stopped at once
 * by the profile check that follows it (see requireRole).
 */
export const createTokenVerifier = ({ verify, ttlMs }) => {
  const cache = createTtlCache(ttlMs);
  const fresh = (decoded) => !decoded.exp || decoded.exp * 1000 > Date.now();

  const verified = async (token) => {
    try {
      return await verify(token);
    } catch (error) {
      if (isCredentialProblem(error)) throw new HttpError(401, SESSION_EXPIRED);
      throw error;
    }
  };

  return async (token) => {
    const decoded = await cache.get(token, () => verified(token));
    if (fresh(decoded)) return decoded;
    cache.delete(token);
    return verified(token);
  };
};

export const verifyIdToken = createTokenVerifier({
  verify: (token) => getAdminAuth().verifyIdToken(token, true),
  ttlMs: env.AUTH_CACHE_TTL_MS,
});

/** The verified phone number of an account, or null when it has none. */
export const phoneNumberOf = async (uid) => {
  try {
    return (await getAdminAuth().getUser(uid)).phoneNumber ?? null;
  } catch (error) {
    if (isCredentialProblem(error)) throw new HttpError(401, SESSION_EXPIRED);
    throw error;
  }
};
