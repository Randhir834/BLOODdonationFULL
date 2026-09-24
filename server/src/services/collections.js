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

// One document holding the running blood totals: { "A+": { in: 700, out: 300 }, ... }
export const stockStatsRef = () => getDb().collection("stats").doc("stock");
