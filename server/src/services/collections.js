import { getDb } from "../config/firebase.js";

// Every Firestore collection the API touches, in one place.
export const usersCollection = () => getDb().collection("users");
export const inventoryCollection = () => getDb().collection("inventory");
export const adminsCollection = () => getDb().collection("admins");
export const auditLogsCollection = () => getDb().collection("auditLogs");
export const requestsCollection = () => getDb().collection("bloodRequests");
export const requestResponsesCollection = () => getDb().collection("requestResponses");
export const notificationsCollection = () => getDb().collection("notifications");
export const campsCollection = () => getDb().collection("camps");
// Blood held by hospitals, same document shape as `inventory` (which is the blood banks' stock).
export const hospitalStockCollection = () => getDb().collection("hospitalStock");

// One document holding the running blood totals: { "A+": { in: 700, out: 300 }, ... }
export const stockStatsRef = () => getDb().collection("stats").doc("stock");
// A hospital or blood bank hiding a request from its own list ("not for us"); nobody else ever sees it.
export const requestDismissalsCollection = () => getDb().collection("requestDismissals");
