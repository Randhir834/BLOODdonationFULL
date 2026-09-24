const read = (key) => import.meta.env[key];

/** Settings the app cannot start without. */
export const REQUIRED = [
  "VITE_API_URL",
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
];

export const missingConfig = REQUIRED.filter((key) => !read(key));

const isProduction = import.meta.env.PROD;

export const env = {
  apiUrl: read("VITE_API_URL"),
  // The OTP-less "direct" sign-in is a development shortcut, production builds always use SMS codes.
  authMode: read("VITE_AUTH_MODE") === "direct" && !isProduction ? "direct" : "otp",
  smsCountries: (read("VITE_SMS_COUNTRIES") || "IN").split(",").map((id) => id.trim().toUpperCase()),
  disableAppVerification: read("VITE_DISABLE_APP_VERIFICATION") === "true" && !isProduction,
  firebase: {
    apiKey: read("VITE_FIREBASE_API_KEY"),
    authDomain: read("VITE_FIREBASE_AUTH_DOMAIN"),
    projectId: read("VITE_FIREBASE_PROJECT_ID"),
    storageBucket: read("VITE_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: read("VITE_FIREBASE_MESSAGING_SENDER_ID"),
    appId: read("VITE_FIREBASE_APP_ID"),
    measurementId: read("VITE_FIREBASE_MEASUREMENT_ID"),
  },
};
