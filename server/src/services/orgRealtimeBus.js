import { logger } from "../utils/logger.js";

// Server-Sent Events for the hospital / blood bank website. Unlike the admin bus (which tells every admin
// everything), each open tab is registered under its own account and only hears about that account's data.
const clients = new Map(); // account id -> Set of open responses
const PING_INTERVAL_MS = 20_000;

const write = (organisation, res, payload) => {
  try {
    res.write(payload);
  } catch (err) {
    logger.warn({ err }, "Organisation realtime write failed, dropping the client");
    clients.get(organisation)?.delete(res);
  }
};

/** Registers one browser tab of an account. Returns a function that unregisters it. */
export const subscribeOrganisation = (organisation, res) => {
  if (!clients.has(organisation)) clients.set(organisation, new Set());
  clients.get(organisation).add(res);
  return () => {
    const set = clients.get(organisation);
    set?.delete(res);
    if (set?.size === 0) clients.delete(organisation);
  };
};

/** Tells the open tabs of one account that `resource` changed, so they refetch it. */
export const broadcastToOrganisation = (organisation, resource) => {
  const set = clients.get(organisation);
  if (!set) return;
  const payload = `data: ${JSON.stringify({ resource, at: new Date().toISOString() })}\n\n`;
  set.forEach((res) => write(organisation, res, payload));
};

setInterval(
  () => clients.forEach((set, organisation) => set.forEach((res) => write(organisation, res, ": ping\n\n"))),
  PING_INTERVAL_MS
).unref();

export const organisationClientCount = () => [...clients.values()].reduce((sum, set) => sum + set.size, 0);
