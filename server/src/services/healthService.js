import { getAdminAuth, getDb } from "../config/firebase.js";
import { env } from "../config/env.js";

/** Times one call and reports ok / error instead of throwing. */
const probe = async (call) => {
  const started = Date.now();
  try {
    await call();
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    return { ok: false, latencyMs: Date.now() - started, message: error.code || error.message };
  }
};

/** Is everything the API depends on reachable? */
export const checkDependencies = async () => {
  const [firestore, auth] = await Promise.all([
    probe(() => getDb().collection("users").limit(1).get()),
    probe(() => getAdminAuth().listUsers(1)),
  ]);
  return { firestore, auth };
};

export const serverInfo = () => ({
  uptimeSeconds: Math.round(process.uptime()),
  node: process.version,
  mode: env.NODE_ENV,
});
