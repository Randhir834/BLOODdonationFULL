import { useEffect, useRef } from "react";
import { onRealtime } from "../lib/realtime";

const DEBOUNCE_MS = 200;

/**
 * Calls `reload` shortly after any of `resources` changes on the server (pushed over the realtime
 * connection, see lib/realtime.js), coalescing a burst of changes into a single refetch. Pass the
 * resource name(s) the screen's data depends on, e.g. "requests" for the requests list, or an array
 * when a screen reads more than one.
 */
export function useRealtime(resources, reload) {
  const reloadRef = useRef(reload);
  const key = Array.isArray(resources) ? resources.join(",") : resources;

  useEffect(() => {
    reloadRef.current = reload;
  });

  useEffect(() => {
    let timer = null;
    const trigger = () => {
      clearTimeout(timer);
      timer = setTimeout(() => reloadRef.current(), DEBOUNCE_MS);
    };
    const unsubscribes = key.split(",").map((resource) => onRealtime(resource, trigger));
    return () => {
      clearTimeout(timer);
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [key]);
}
