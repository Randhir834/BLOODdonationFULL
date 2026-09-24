import { useCallback, useEffect, useRef, useState } from "react";
import api, { errorMessage } from "../lib/api";

/**
 * GET `url`, and again when `params` change or reload() is called.
 * The previous data stays while reloading (no flash). Returns { data, loading, error, reload }.
 *
 * `enabled: false` makes it do nothing at all (no request, never "loading"), for data only some accounts have.
 */
export function useApi(url, params, { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, loading: enabled, error: null });
  const latest = useRef(0);
  const key = JSON.stringify(params || {});

  const reload = useCallback(async () => {
    if (!enabled) return;
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
  }, [url, key, enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...state, reload };
}
