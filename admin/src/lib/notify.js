// The one way this product tells someone that something happened: `notify.success("Profile updated")`.
// A message is one short line. It appears in the same place, looks the same and behaves the same on every
// screen (see components/Toaster.jsx). The admin website carries an identical copy of this file and of the
// Toaster, so both products share one notification system.

const DURATION_MS = { success: 3500, info: 3500, warning: 4500, error: 5000 };
const LEAVE_MS = 150;
const MAX_VISIBLE = 2;

let toasts = [];
let nextId = 0;
const timers = new Map();
const listeners = new Set();

const publish = (next) => {
  toasts = next;
  listeners.forEach((listener) => listener());
};

const forget = (id) => {
  clearTimeout(timers.get(id));
  timers.delete(id);
};

const remove = (id) => {
  forget(id);
  publish(toasts.filter((toast) => toast.id !== id));
};

const schedule = (id, kind) => {
  forget(id);
  timers.set(
    id,
    setTimeout(() => {
      publish(toasts.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast)));
      timers.set(
        id,
        setTimeout(() => remove(id), LEAVE_MS)
      );
    }, DURATION_MS[kind])
  );
};

const show = (kind) => (message) => {
  if (!message) return;
  // The same message twice in a row is one message: it stays a little longer instead of stacking up.
  const same = toasts.find((toast) => toast.kind === kind && toast.message === message && !toast.leaving);
  if (same) {
    schedule(same.id, kind);
    return;
  }
  const id = nextId++;
  const kept = toasts.slice(-(MAX_VISIBLE - 1));
  toasts.filter((toast) => !kept.includes(toast)).forEach((toast) => forget(toast.id));
  publish([...kept, { id, kind, message, leaving: false }]);
  schedule(id, kind);
};

/** Removes every message at once, e.g. between tests. */
const clear = () => {
  [...timers.keys()].forEach(forget);
  publish([]);
};

export const notify = {
  clear,
  success: show("success"),
  error: show("error"),
  warning: show("warning"),
  info: show("info"),
};

export const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const getToasts = () => toasts;
