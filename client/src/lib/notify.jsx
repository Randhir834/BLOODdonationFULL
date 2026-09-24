import { toast } from "react-toastify";
import { ToastBody } from "../components/Toast";

const show = (kind) => (title, description) =>
  toast[kind](<ToastBody title={title} description={description} />);

/**
 * The one way the app tells someone something happened: `notify.success("Profile updated", "Your
 * address and city were saved.")`. A short title, and optionally one line of detail. Styling and the icon
 * come from the <ToastContainer> in app/App.jsx, so every message looks the same.
 */
export const notify = {
  success: show("success"),
  error: show("error"),
  warning: show("warn"),
  info: show("info"),
};
