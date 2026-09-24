import { useCallback, useEffect, useRef, useState } from "react";
import api, { errorMessage } from "../lib/api";

/**
 * GET `url`, and again when `params` change or reload() is called.
 * The previous data stays while reloading (no flash). Returns { data, loading, error, reload }.
 *
 * `pollMs`, when given, also reloads on that interval for as long as the component stays mounted. Only
 * for data with no realtime push to rely on (see useRealtime) and where a check going quietly stale would
 * be actively misleading, e.g. the system health pill: without this, it never learns Firestore or Auth
 * went down after its first check, since a down service can not push a change notification about itself.
 */
export function useApi(url, params, pollMs) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const latest = useRef(0);
  const key = JSON.stringify(params || {});

  const reload = useCallback(async () => {
    const id = ++latest.current;
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const { data } = await api.get(url, { params: JSON.parse(key) });
      if (id === latest.current) setState({ data, loading: false, error: null });
    } catch (error) {
      if (id === latest.current) {
        setState((current) => ({ ...current, loading: false, error: errorMessage(error) }));
      }
    }
  }, [url, key]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!pollMs) return undefined;
    const timer = setInterval(reload, pollMs);
    return () => clearInterval(timer);
  }, [pollMs, reload]);

  return { ...state, reload };
}
