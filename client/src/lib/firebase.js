import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { env, missingConfig } from "./env";

// A build with missing settings shows the ConfigError screen and never reaches Firebase.
const app = missingConfig.length ? null : initializeApp(env.firebase);

export const auth = app && getAuth(app);

// Firebase honours this only for the numbers under Authentication > Sign-in method > Phone >
// "Phone numbers for testing". Never on in production builds (see env.js).
if (auth && env.disableAppVerification) auth.settings.appVerificationDisabledForTesting = true;

/** Starts Google Analytics when a measurement id is configured and the browser supports it. */
export const initAnalytics = async () => {
  if (!app || !env.firebase.measurementId) return;
  const { getAnalytics, isSupported } = await import("firebase/analytics");
  if (await isSupported()) getAnalytics(app);
};
