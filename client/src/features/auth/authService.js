import {
  RecaptchaVerifier,
  onAuthStateChanged,
  signInWithCustomToken,
  signInWithPhoneNumber,
  signOut,
} from "firebase/auth";
import { api, errorMessage } from "../../lib/api";
import { auth } from "../../lib/firebase";
import { setSession } from "./authSlice";

const CODE_TIMEOUT_MS = 60_000;

let verifier = null;
let confirmation = null;

/** Call once at startup: keeps the store in sync with the Firebase session (which survives reloads). */
export const initAuth = (dispatch) =>
  onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      dispatch(setSession({ signedIn: false, user: null }));
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      dispatch(setSession({ signedIn: true, user: data.user }));
    } catch (error) {
      console.error(error);
      // Only a rejected token (401, e.g. the account was suspended or removed) means the session itself
      // is invalid; the api.js interceptor already signs out for that case. Anything else — a timeout, a
      // 5xx, being briefly offline, a cold-start backend — is not evidence the sign-in is bad, so it must
      // not force a real, signed-in phone number back through OTP for what may be a passing network blip.
      // Leaving the state as `loading` here (rather than dispatching signedIn: false) keeps the splash
      // screen up instead of bouncing them to the login page while Firebase still has them signed in.
      if (error.response?.status !== 401) return;
      await signOut(auth);
    }
  });

/** Releases the invisible reCAPTCHA widget. Call when leaving the phone sign-in screen (it is otherwise
 * only cleared right before the next `sendOtp` call, leaving a live widget instance around until then). */
export const clearVerifier = () => {
  verifier?.clear();
  verifier = null;
};

/**
 * Development sign-in (VITE_AUTH_MODE=direct): the server trusts the number and hands back a token.
 * `phone` is E.164, e.g. +919876543210. The auth listener above takes over once signed in.
 */
export const signInDirect = async (phone) => {
  const { data } = await api.post("/auth/phone-login", { phone });
  await signInWithCustomToken(auth, data.token);
};

const codeError = (code, message) => Object.assign(new Error(message), { code });

/** Step 1 of OTP sign-in: Firebase texts a 6-digit code to this number (E.164). */
export const sendOtp = async (phone) => {
  // A used reCAPTCHA can not be reused, so build a fresh invisible one every time.
  verifier?.clear();
  verifier = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });

  // If the reCAPTCHA challenge is closed without being solved, Firebase never answers: give up after a minute.
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(codeError("app/verification-timeout", "Verification timed out")),
      CODE_TIMEOUT_MS
    );
  });
  try {
    confirmation = await Promise.race([signInWithPhoneNumber(auth, phone, verifier), timeout]);
  } catch (error) {
    verifier.clear();
    verifier = null;
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

/** Step 2 of OTP sign-in: checks the code. On success the auth listener takes over. */
export const verifyOtp = async (code) => {
  if (!confirmation) throw codeError("app/no-pending-code", "No code was requested");
  await confirmation.confirm(code);
  confirmation = null;
};

/** Step 3, first sign-in only: creates the profile of the verified number. Returns the profile. */
export const registerProfile = async (profile) => {
  const { data } = await api.post("/auth/register", profile);
  return data.user;
};

/** Loads the profile again, for someone waiting for approval who wants to know if an admin has decided. */
export const refreshProfile = async (dispatch) => {
  const { data } = await api.get("/auth/me");
  dispatch(setSession({ signedIn: true, user: data.user }));
  return data.user;
};

/** The signed-in user corrects their own address/city (e.g. an account created before city existed). */
export const updateProfile = async (dispatch, { address, city }) => {
  const { data } = await api.patch("/auth/me", { address, city });
  dispatch(setSession({ signedIn: true, user: data.user }));
  return data.user;
};

export const logout = () => signOut(auth);

const MESSAGES = {
  "auth/invalid-phone-number": "That does not look like a valid mobile number.",
  "auth/invalid-verification-code": "That code is incorrect. Check the SMS and try again.",
  "auth/code-expired": "That code has expired. Ask for a new one.",
  "auth/too-many-requests": "Too many attempts. Please wait a few minutes and try again.",
  "auth/quota-exceeded": "We can not send more codes right now. Please try again later.",
  "auth/captcha-check-failed": "We could not verify this device. Refresh the page and try again.",
  "auth/invalid-app-credential": "We could not verify this device. Refresh the page and try again.",
  "auth/missing-app-credential": "We could not verify this device. Refresh the page and try again.",
  "app/verification-timeout":
    "Verification did not finish. Please try again and complete the security check.",
  "app/no-pending-code": "Please ask for a code first.",
  // The Firebase project is on the free plan: real SMS needs the Blaze (pay as you go) plan.
  "auth/billing-not-enabled": "We can not send SMS codes right now. Please try again later.",
  "auth/operation-not-allowed":
    "We can not send an SMS to this number yet. Try a number from a supported country.",
  "auth/network-request-failed": "No connection. Check your internet and try again.",
};

/** A readable message for what Firebase or the API threw. Raw Firebase text never reaches people. */
export const authErrorMessage = (error) => MESSAGES[error?.code] ?? errorMessage(error);
