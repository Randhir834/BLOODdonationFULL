import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { env } from "./env.js";

const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const loadCredential = () => {
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON));
  }
  if (env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const file = path.resolve(SERVER_ROOT, env.FIREBASE_SERVICE_ACCOUNT_PATH);
    if (!existsSync(file)) {
      throw new Error(`FIREBASE_SERVICE_ACCOUNT_PATH points to a file that does not exist: ${file}`);
    }
    return cert(JSON.parse(readFileSync(file, "utf8")));
  }
  return applicationDefault();
};

const ensureApp = () => {
  if (!getApps().length) initializeApp({ credential: loadCredential() });
};

let firestore;

/** Firestore instance, created on first use so that configuration is always loaded before it. */
export const getDb = () => {
  if (!firestore) {
    ensureApp();
    firestore = getFirestore();
    firestore.settings({ ignoreUndefinedProperties: true });
  }
  return firestore;
};

/** Firebase Authentication. Sign-in happens in the apps, the server only verifies and manages accounts. */
export const getAdminAuth = () => {
  ensureApp();
  return getAuth();
};
