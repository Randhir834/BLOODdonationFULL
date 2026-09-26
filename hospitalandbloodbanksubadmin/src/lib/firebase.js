import { initializeApp } from "firebase/app";
import { browserSessionPersistence, getAuth, setPersistence } from "firebase/auth";
import { env, missingConfig } from "./env";

// A build with missing settings shows the "not configured" screen and never reaches Firebase.
const app = missingConfig.length ? null : initializeApp(env.firebase);

export const auth = app && getAuth(app);

// The session ends when the browser tab is closed: this website is often used on a shared computer.
if (auth) setPersistence(auth, browserSessionPersistence).catch(() => {});

// Firebase honours this only for the numbers under Authentication > Sign-in method > Phone >
// "Phone numbers for testing". Never on in production builds (see env.js).
if (auth && env.disableAppVerification) auth.settings.appVerificationDisabledForTesting = true;
