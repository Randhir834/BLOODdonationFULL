import { useCallback, useEffect, useMemo, useState } from "react";
import {
  browserSessionPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import api, { errorMessage } from "../../lib/api";
import { auth } from "../../lib/firebase";
import { startRealtime, stopRealtime } from "../../lib/realtime";
import { AuthContext } from "./authContext";

// Signed out automatically after this long without any mouse or keyboard activity.
const IDLE_MS = 30 * 60 * 1000;
// Why the sign-in screen came back on its own (idle timeout, or the server ending the session), shown once.
export const SIGNED_OUT_KEY = "bb.admin.signedOut";
const IDLE_NOTICE = "You were signed out after 30 minutes of inactivity.";
const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart"];

export default function AuthProvider({ children }) {
  // `admin` is set only after the server confirmed the account really is an admin.
  const [state, setState] = useState({ loading: true, admin: null, notice: null });

  useEffect(
    () =>
      onAuthStateChanged(auth, async (firebaseUser) => {
        if (!firebaseUser) {
          let reason = null;
          try {
            reason = sessionStorage.getItem(SIGNED_OUT_KEY);
            sessionStorage.removeItem(SIGNED_OUT_KEY);
          } catch {
            // storage unavailable: the reason is simply not shown
          }
          setState((current) => ({ loading: false, admin: null, notice: reason || current.notice }));
          return;
        }
        try {
          const { data } = await api.get("/me");
          setState({ loading: false, admin: data.admin, notice: null });
        } catch (error) {
          const notice =
            error.response?.status === 403 ? "This account is not an admin." : errorMessage(error);
          setState({ loading: false, admin: null, notice });
          await signOut(auth);
        }
      }),
    []
  );

  const isSignedIn = Boolean(state.admin);

  // One realtime connection for the whole app, open only while actually signed in as an admin.
  useEffect(() => {
    if (!isSignedIn) return undefined;
    startRealtime();
    return stopRealtime;
  }, [isSignedIn]);

  useEffect(() => {
    if (!isSignedIn) return undefined;
    let timer;
    // An explicit "Sign out" says nothing; running out of time says why, on the sign-in screen that follows.
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          sessionStorage.setItem(SIGNED_OUT_KEY, IDLE_NOTICE);
        } catch {
          // storage unavailable: the reason is simply not shown
        }
        signOut(auth);
      }, IDLE_MS);
    };
    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, arm, { passive: true }));
    arm();
    return () => {
      clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, arm));
    };
  }, [isSignedIn]);

  const logout = useCallback(() => signOut(auth), []);

  // The session ends when the browser tab is closed.
  const login = useCallback(async (email, password) => {
    setState((current) => ({ ...current, notice: null }));
    await setPersistence(auth, browserSessionPersistence);
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const value = useMemo(() => ({ ...state, login, logout }), [state, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
