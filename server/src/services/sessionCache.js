import { env } from "../config/env.js";
import { createTtlCache } from "../utils/ttlCache.js";

/**
 * The signed-in user's profile, as read by every role-guarded request. Reading it from Firestore on every
 * call added a full round trip to each screen load, so it is reused for a few seconds. Anything that
 * changes a profile (edit, suspension, approval, deletion) calls `forgetSessionUser`, so those take effect
 * at once on this server; only a change made by another server instance can take up to
 * AUTH_CACHE_TTL_MS to be seen. Set that to 0 to turn the cache off.
 */
export const sessionUsers = createTtlCache(env.AUTH_CACHE_TTL_MS);

export const forgetSessionUser = (id) => sessionUsers.delete(id);
