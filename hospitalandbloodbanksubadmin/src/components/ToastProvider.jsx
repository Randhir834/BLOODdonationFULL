import { useCallback } from "react";
import { notify } from "../lib/notify";
import Toaster from "./Toaster";
import { ToastContext } from "./toastContext";

// The admin's call sites say `toast("Saved")` or `toast("Could not save", "error")`; the messages themselves
// are shown by the same notification system, and the same Toaster, as the mobile app.
const KIND = { ok: "success", error: "error", warning: "warning", info: "info" };

export default function ToastProvider({ children }) {
  const toast = useCallback((text, kind = "ok") => notify[KIND[kind] || "info"](text), []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <Toaster />
    </ToastContext.Provider>
  );
}
