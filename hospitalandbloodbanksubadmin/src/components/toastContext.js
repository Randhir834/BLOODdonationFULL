import { createContext, useContext } from "react";

export const ToastContext = createContext(() => {});

/** A short message at the top of the screen: `toast("Saved")` or `toast("Could not save", "error")`. */
export const useToast = () => useContext(ToastContext);
