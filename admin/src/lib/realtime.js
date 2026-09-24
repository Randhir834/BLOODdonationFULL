import { auth } from "./firebase";

// EventSource can not send an Authorization header, so the connection is a plain `fetch` whose body is
// read as a stream and parsed as `text/event-stream` by hand.
const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8080/api/admin").replace(/\/$/, "");
const MIN_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 15_000;

const listeners = new Map(); // resource -> Set<() => void>
let controller = null;
let running = false;
let backoff = MIN_BACKOFF_MS;
let reconnectTimer = null;
let connectedBefore = false;

const emit = (resource) => listeners.get(resource)?.forEach((callback) => callback());

// After a real reconnect (not the first connection this session) something may have changed while the
// stream was down, so every page currently listening for anything refetches once, just in case.
const emitEveryResource = () => listeners.forEach((callbacks) => callbacks.forEach((callback) => callback()));

/** One `text/event-stream` body, fed in chunks. Returns the unparsed remainder to prepend next time. */
const consume = (buffer) => {
  const frames = buffer.split("\n\n");
  const remainder = frames.pop() ?? "";
  frames.forEach((frame) => {
    const line = frame.split("\n").find((entry) => entry.startsWith("data:"));
    if (!line) return; // a bare `: ping` keep-alive comment, nothing to do
    let payload;
    try {
      payload = JSON.parse(line.slice(5).trim());
    } catch {
      return; // a malformed frame is dropped; the next one still arrives
    }
    if (payload.resource === "connected") {
      if (connectedBefore) emitEveryResource();
      connectedBefore = true;
      return;
    }
    emit(payload.resource);
  });
  return remainder;
};

const connectOnce = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  const token = await user.getIdToken();

  const response = await fetch(`${API_URL}/events`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
    signal: controller.signal,
  });
  if (!response.ok || !response.body) throw new Error(`Realtime connection failed (${response.status})`);

  backoff = MIN_BACKOFF_MS; // a successful connection resets the reconnect delay
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer = consume(buffer + decoder.decode(value, { stream: true }));
  }
};

const loop = async () => {
  while (running) {
    try {
      await connectOnce();
    } catch {
      // Network error, expired sign-in, or the tab went offline: fall through and retry below.
    }
    if (!running) return;
    await new Promise((resolve) => {
      reconnectTimer = setTimeout(resolve, backoff);
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
    });
  }
};

/** Opens the one shared realtime connection for the whole app. Safe to call more than once. */
export const startRealtime = () => {
  if (running) return;
  running = true;
  connectedBefore = false;
  backoff = MIN_BACKOFF_MS;
  controller = new AbortController();
  loop();
};

/** Closes the realtime connection. Call on sign-out so a stale session is not kept open. */
export const stopRealtime = () => {
  running = false;
  clearTimeout(reconnectTimer);
  controller?.abort();
  controller = null;
};

/** Calls `callback` whenever `resource` changes on the server. Returns an unsubscribe function. */
export const onRealtime = (resource, callback) => {
  if (!listeners.has(resource)) listeners.set(resource, new Set());
  listeners.get(resource).add(callback);
  return () => listeners.get(resource)?.delete(callback);
};
