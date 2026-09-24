import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Web app config from Firebase console > Project settings > Your apps (see .env.example).
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.appId);

if (!firebaseConfigured) {
  console.error("Missing Firebase web config. Fill in admin/.env (see admin/.env.example).");
}

// The placeholder key only keeps the page loading so the sign-in screen can explain what is missing.
export const auth = getAuth(
  initializeApp(
    firebaseConfigured ? firebaseConfig : { ...firebaseConfig, apiKey: "missing", appId: "missing" }
  )
);
