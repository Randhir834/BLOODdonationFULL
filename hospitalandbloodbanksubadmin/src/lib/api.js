import axios from "axios";
import { signOut } from "firebase/auth";
import { env } from "./env";
import { auth } from "./firebase";

const api = axios.create({ baseURL: env.apiUrl, timeout: 30_000 });

// Always send a fresh Firebase ID token (the SDK refreshes it shortly before it expires).
api.interceptors.request.use(async (config) => {
  const user = auth?.currentUser;
  if (user) config.headers.Authorization = `Bearer ${await user.getIdToken()}`;
  return config;
});

export const SIGNED_OUT_KEY = "bb.portal.signedOut";

// A rejected token mid-session (account removed, sessions revoked) means: sign in again.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && auth?.currentUser) {
      try {
        sessionStorage.setItem(SIGNED_OUT_KEY, "Your session ended. Please sign in again.");
      } catch {
        // storage unavailable: the reason is simply not shown
      }
      signOut(auth);
    }
    return Promise.reject(error);
  }
);

/** A readable message for a failed API call (for a rejected form, the first problem with it). */
export const errorMessage = (error, fallback = "Something went wrong") => {
  if (error?.response?.data?.message) return error.response.data.message;
  if (axios.isAxiosError(error) && !error.response)
    return "Could not reach the server. Check your connection.";
  return fallback;
};

/** The per-field messages of a rejected form, { field: "message" } (the first one of each), or {}. */
export const fieldErrors = (error) => {
  const list = error?.response?.data?.errors;
  if (!Array.isArray(list)) return {};
  const found = {};
  list.forEach(({ field, message }) => {
    if (field && !found[field]) found[field] = message;
  });
  return found;
};

/** Downloads a file the API answers with (a CSV export), keeping the sign-in header. */
export const download = async (url, params) => {
  const response = await api.get(url, { params, responseType: "blob" });
  const name =
    /filename="?([^";]+)"?/.exec(response.headers["content-disposition"] || "")?.[1] || "export.csv";
  const link = document.createElement("a");
  link.href = URL.createObjectURL(response.data);
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
};

export default api;
