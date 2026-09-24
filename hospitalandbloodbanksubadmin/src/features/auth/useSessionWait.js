import { useEffect, useState } from "react";

/**
 * After a successful sign-in the auth listener loads the profile and the page moves on by itself.
 * `waiting` keeps the form disabled meanwhile, with a safety net in case nothing happens.
 */
export function useSessionWait(timeoutMs = 12_000) {
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    if (!waiting) return undefined;
    const timer = setTimeout(() => setWaiting(false), timeoutMs);
    return () => clearTimeout(timer);
  }, [waiting, timeoutMs]);

  return [waiting, () => setWaiting(true)];
}
