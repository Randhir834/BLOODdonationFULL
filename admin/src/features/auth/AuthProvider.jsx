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
const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart"];

export default function AuthProvider({ children }) {
  // `admin` is set only after the server confirmed the account really is an admin.
  const [state, setState] = useState({ loading: true, admin: null, notice: null });

  useEffect(
    () =>
      onAuthStateChanged(auth, async (firebaseUser) => {
        if (!firebaseUser) {
          setState((current) => ({ loading: false, admin: null, notice: current.notice }));
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
    // Signs out quietly: no banner on the next login screen, only an explicit "Sign out" shows nothing
    // either, so this stays consistent with that (see `logout` below).
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => signOut(auth), IDLE_MS);
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
