import { createContext, useContext } from "react";

export const ToastContext = createContext(() => {});

/** Small messages in the corner: `toast("Saved")` or `toast("Could not save", "error")`. */
export const useToast = () => useContext(ToastContext);
