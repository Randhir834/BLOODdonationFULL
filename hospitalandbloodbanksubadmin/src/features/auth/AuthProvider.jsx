import { onAuthStateChanged, signOut } from "firebase/auth";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api, { SIGNED_OUT_KEY, errorMessage } from "../../lib/api";
import { auth } from "../../lib/firebase";
import { startRealtime, stopRealtime } from "../../lib/realtime";
import { AuthContext } from "./authContext";

// Signed out automatically after this long without any mouse or keyboard activity: the website is often
// left open on a shared computer.
const IDLE_MS = 60 * 60 * 1000;
const IDLE_NOTICE = "You were signed out after an hour of inactivity.";
const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart"];

const takeSignedOutReason = () => {
  try {
    const reason = sessionStorage.getItem(SIGNED_OUT_KEY);
    sessionStorage.removeItem(SIGNED_OUT_KEY);
    return reason;
  } catch {
    return null; // storage unavailable: the reason is simply not shown
  }
};

const INITIAL = { loading: true, signedIn: false, user: null, notice: null, loadError: null };

export default function AuthProvider({ children }) {
  const [state, setState] = useState(INITIAL);
  const registering = useRef(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setState({ loading: false, signedIn: true, user: data.user, notice: null, loadError: null });
      return data.user;
    } catch (error) {
      const status = error.response?.status;
      // A rejected token, or a donor's account, means this session is no use here.
      if (status === 401 || status === 403) {
        setState({ ...INITIAL, loading: false, notice: status === 403 ? errorMessage(error) : null });
        await signOut(auth);
        return null;
      }
      // Anything else (the server is down, being offline) is not evidence the sign-in is bad.
      setState((current) => ({ ...current, loading: false, signedIn: true, loadError: errorMessage(error) }));
      return null;
    }
  }, []);

  useEffect(() => {
    if (!auth) {
      setState({ ...INITIAL, loading: false });
      return undefined;
    }
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setState((current) => ({
          ...INITIAL,
          loading: false,
          notice: takeSignedOutReason() || current.notice,
        }));
        return;
      }
      // While a new account is being created the sign-in has already happened; nothing to load yet.
      if (!registering.current) await load();
    });
  }, [load]);

  const register = useCallback(async (profile) => {
    registering.current = true;
    try {
      const { data } = await api.post("/auth/register", profile);
      setState({ loading: false, signedIn: true, user: data.user, notice: null, loadError: null });
      return data.user;
    } finally {
      registering.current = false;
    }
  }, []);

  const logout = useCallback(() => signOut(auth), []);

  const active =
    Boolean(state.user) && state.user.verification === "approved" && state.user.status !== "suspended";

  // One realtime connection for the whole app, open only while signed in with an approved account.
  useEffect(() => {
    if (!active) return undefined;
    startRealtime();
    return stopRealtime;
  }, [active]);

  useEffect(() => {
    if (!state.signedIn) return undefined;
    let timer;
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
  }, [state.signedIn]);

  const value = useMemo(
    () => ({ ...state, register, reload: load, logout }),
    [state, register, load, logout]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
