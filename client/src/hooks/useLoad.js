import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "../lib/api";
import { readCache, writeCache } from "../lib/dataCache";

/**
 * Loads data with `fetcher(params)` (a stable function returning a promise) on mount, when `params`
 * change, and again on reload(). The previous data stays on screen while reloading.
 *
 * With a `cacheKey`, the last answer for that screen (and these params) is shown instantly on the next
 * visit, even after the app was closed, while the fresh answer loads behind it and replaces it. Only use
 * it for a screen whose data belongs to the signed-in user; the cache is wiped when they change.
 * Returns { data, loading, error, reload }.
 */
export function useLoad(fetcher, params, cacheKey) {
  const key = JSON.stringify(params ?? null);
  const storeKey = cacheKey ? `${cacheKey}:${key}` : null;
  const [state, setState] = useState(() => ({
    data: (storeKey && readCache(storeKey)) ?? null,
    loading: true,
    error: null,
  }));
  const latest = useRef(0);

  const reload = useCallback(async () => {
    const id = ++latest.current;
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const data = await fetcher(JSON.parse(key));
      if (id === latest.current) {
        if (storeKey) writeCache(storeKey, data);
        setState({ data, loading: false, error: null });
      }
    } catch (error) {
      if (id === latest.current) {
        setState((current) => ({ ...current, loading: false, error: errorMessage(error) }));
      }
    }
  }, [fetcher, key, storeKey]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...state, reload };
}
