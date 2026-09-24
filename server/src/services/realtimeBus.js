import { logger } from "../utils/logger.js";

// Every admin browser currently connected for Server-Sent Events (one per open tab).
const clients = new Set();
const PING_INTERVAL_MS = 20_000;

const write = (res, payload) => {
  try {
    res.write(payload);
  } catch (err) {
    logger.warn({ err }, "Realtime client write failed, dropping it");
    clients.delete(res);
  }
};

/** Registers one admin browser's SSE connection. Returns a function that unregisters it. */
export const subscribe = (res) => {
  clients.add(res);
  return () => clients.delete(res);
};

/** Tells every connected admin browser that `resource` changed, so it can refetch it. */
export const broadcast = (resource) => {
  const payload = `data: ${JSON.stringify({ resource, at: new Date().toISOString() })}\n\n`;
  clients.forEach((res) => write(res, payload));
};

// Keeps the connection open through proxies and load balancers that drop silent sockets, and lets a
// browser detect a dead connection quickly instead of hanging until the OS notices.
setInterval(() => clients.forEach((res) => write(res, ": ping\n\n")), PING_INTERVAL_MS).unref();

export const clientCount = () => clients.size;
