import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Filters that live in the address bar, so a filtered list can be shared and survives a reload.
 * `get(key)` reads one ("" when unset). `update(patch)` sets keys (a falsy value removes the key) and goes
 * back to page 1, unless the patch sets `page` itself or `keepPage` is true. `reset()` clears everything.
 */
export function useQueryParams() {
  const [params, setParams] = useSearchParams();

  const get = (key) => params.get(key) || "";

  const update = useCallback(
    (patch, keepPage = false) =>
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          Object.entries(patch).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
          if (!keepPage && !("page" in patch)) next.delete("page");
          return next;
        },
        { replace: true }
      ),
    [setParams]
  );

  const reset = useCallback(() => setParams({}, { replace: true }), [setParams]);

  return { get, update, reset };
}
