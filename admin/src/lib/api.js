import axios from "axios";
import { signOut } from "firebase/auth";
import { auth } from "./firebase";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8080/api/admin",
  timeout: 30_000,
});

// Always send a fresh Firebase ID token (the SDK refreshes it shortly before it expires).
api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) config.headers.Authorization = `Bearer ${await user.getIdToken()}`;
  return config;
});

// A rejected token mid-session (account removed, sessions revoked) means: sign in again.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && auth.currentUser) signOut(auth);
    return Promise.reject(error);
  }
);

/** A readable message for a failed API call. */
export const errorMessage = (error) => {
  if (error?.response?.data?.message) return error.response.data.message;
  if (axios.isAxiosError(error) && !error.response)
    return "Could not reach the server. Check your connection.";
  return error?.message || "Something went wrong";
};

export default api;
