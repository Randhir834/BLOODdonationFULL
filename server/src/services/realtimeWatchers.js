import { logger } from "../utils/logger.js";
import {
  adminsCollection,
  auditLogsCollection,
  campsCollection,
  hospitalStockCollection,
  inventoryCollection,
  notificationsCollection,
  requestResponsesCollection,
  requestsCollection,
  stockStatsRef,
  usersCollection,
} from "./collections.js";
import { clearDashboardCache } from "./dashboardService.js";
import { broadcastToOrganisation } from "./orgRealtimeBus.js";
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

// The same idea for the hospital / blood bank website, but scoped: a change is announced only to the account it
// belongs to. A watcher's optional `concerns(data, id)` says which accounts, and which of their resources, a
// changed document is about, as [[accountId, ["resource", ...]], ...].
const orgTimers = new Map();
const notifyOrganisation = (organisation, resource) => {
  const key = `${organisation}|${resource}`;
  clearTimeout(orgTimers.get(key));
  orgTimers.set(
    key,
    setTimeout(() => {
      orgTimers.delete(key);
      broadcastToOrganisation(organisation, resource);
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
  const watchCollection = (query, resources, source, concerns) => {
    let first = true;
    query.onSnapshot((snapshot) => {
      if (first) {
        first = false;
        return;
      }
      if (snapshot.docChanges().length === 0) return;
      clearDashboardCache();
      resources.forEach(notify);
      if (concerns) {
        snapshot.docChanges().forEach((change) => {
          concerns(change.doc.data(), change.doc.id).forEach(([organisation, list]) => {
            if (organisation) list.forEach((resource) => notifyOrganisation(organisation, resource));
          });
        });
      }
    }, onError(source));
  };

  // "locations" covers a user's `location`/`locationSharing` fields, which live on the same document.
  watchCollection(usersCollection(), ["users", "dashboard", "locations"], "users", (_doc, id) => [[id, ["profile"]]]);
  watchCollection(inventoryCollection(), ["inventory", "dashboard"], "inventory", (doc) => [
    [doc.organisation, ["stock", "dashboard"]],
    [doc.hospital, ["stock", "dashboard"]],
  ]);
  watchCollection(adminsCollection(), ["admins"], "admins");
  watchCollection(auditLogsCollection(), ["audit"], "audit");
  watchCollection(campsCollection(), ["camps", "locations"], "camps");
  watchCollection(requestsCollection(), ["requests", "dashboard"], "requests", (doc) => [
    [doc.requester, ["requests", "dashboard"]],
    [doc.organisation, ["requests", "dashboard"]],
  ]);
  // A response is only ever read through its request (the request's own units-confirmed count and the
  // requester's response list), so a response change is announced as a "requests" change, not its own.
  watchCollection(requestResponsesCollection(), ["requests"], "requestResponses", (doc) => [
    [doc.responderId, ["requests", "dashboard"]],
  ]);
  // A new notification also means the request list changed (a request was raised, an offer arrived).
  watchCollection(notificationsCollection(), ["notifications"], "notifications", (doc) => [
    [doc.recipient, ["notifications", "requests", "dashboard"]],
  ]);
  // A hospital's own stock is read by no admin screen, so it only ever concerns its owner.
  watchCollection(hospitalStockCollection(), [], "hospitalStock", (doc) => [[doc.organisation, ["stock", "dashboard"]]]);

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
