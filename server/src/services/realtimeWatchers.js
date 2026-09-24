import { logger } from "../utils/logger.js";
import {
  adminsCollection,
  auditLogsCollection,
  campsCollection,
  inventoryCollection,
  notificationsCollection,
  requestResponsesCollection,
  requestsCollection,
  stockStatsRef,
  usersCollection,
} from "./collections.js";
import { clearDashboardCache } from "./dashboardService.js";
import { broadcast } from "./realtimeBus.js";

// Coalesces a burst of changes to the same resource (a batch write, a migration script) into one
// broadcast, so admin browsers refetch once instead of once per document.
const DEBOUNCE_MS = 250;
const timers = new Map();

const notify = (resource) => {
  clearTimeout(timers.get(resource));
  timers.set(
    resource,
    setTimeout(() => {
      timers.delete(resource);
      broadcast(resource);
    }, DEBOUNCE_MS)
  );
};

let started = false;

/**
 * Watches every Firestore collection the admin website reads, and pushes a "this changed, refetch it"
 * event over SSE whenever one does — whether the write came from the admin website itself, a donor,
 * a hospital or a blood bank in the mobile app, since they all go through the same collections.
 * Idempotent: safe to call more than once, only the first call does anything.
 */
export const startRealtimeWatchers = () => {
  if (started) return;
  started = true;

  const onError = (source) => (err) => logger.error({ err, source }, "Firestore realtime watcher failed");

  // A collection's `onSnapshot` replays every existing document on the first callback; that is not a
  // change, so it is skipped. `dashboard` is included wherever the change could move a dashboard number
  // (a stat, the attention list, the stock chart) or its "latest" lists.
  const watchCollection = (query, resources, source) => {
    let first = true;
    query.onSnapshot((snapshot) => {
      if (first) {
        first = false;
        return;
      }
      if (snapshot.docChanges().length === 0) return;
      clearDashboardCache();
      resources.forEach(notify);
    }, onError(source));
  };

  // "locations" covers a user's `location`/`locationSharing` fields, which live on the same document.
  watchCollection(usersCollection(), ["users", "dashboard", "locations"], "users");
  watchCollection(inventoryCollection(), ["inventory", "dashboard"], "inventory");
  watchCollection(adminsCollection(), ["admins"], "admins");
  watchCollection(auditLogsCollection(), ["audit"], "audit");
  watchCollection(campsCollection(), ["camps", "locations"], "camps");
  watchCollection(requestsCollection(), ["requests", "dashboard"], "requests");
  // A response is only ever read through its request (the request's own units-confirmed count and the
  // requester's response list), so a response change is announced as a "requests" change, not its own.
  watchCollection(requestResponsesCollection(), ["requests"], "requestResponses");
  watchCollection(notificationsCollection(), ["notifications"], "notifications");

  // The running stock totals live on one document, updated in the same transaction as every blood
  // record — watched separately since it is a document, not a collection.
  let firstStock = true;
  stockStatsRef().onSnapshot((snapshot) => {
    if (firstStock) {
      firstStock = false;
      return;
    }
    if (!snapshot.exists) return;
    clearDashboardCache();
    notify("dashboard");
  }, onError("stock"));

  logger.info("Realtime Firestore watchers started");
};
