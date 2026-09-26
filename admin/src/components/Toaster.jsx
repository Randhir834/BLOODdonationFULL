import { useSyncExternalStore } from "react";
import { getToasts, subscribe } from "../lib/notify";

// The same 24px line icons as the rest of the interface, drawn small next to the message.
const CIRCLE = "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z";
const ICONS = {
  success: [CIRCLE, "m9 12 2 2 4-4"],
  error: [CIRCLE, "m15 9-6 6", "m9 9 6 6"],
  warning: [
    "m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z",
    "M12 9v4",
    "M12 17h.01",
  ],
  info: [CIRCLE, "M12 16v-4", "M12 8h.01"],
};

/** Renders the messages sent with `notify`. Mount it once, at the top of the app. */
export default function Toaster() {
  const toasts = useSyncExternalStore(subscribe, getToasts);
  return (
    <div className="toaster" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.kind}${toast.leaving ? " is-leaving" : ""}`}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {ICONS[toast.kind].map((d) => (
              <path key={d} d={d} />
            ))}
          </svg>
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
