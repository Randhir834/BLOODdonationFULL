import axios from "axios";
import { signOut } from "firebase/auth";
import { env } from "./env";
import { auth } from "./firebase";

export const api = axios.create({ baseURL: env.apiUrl, timeout: 20_000 });

// Always send a fresh Firebase ID token (the SDK refreshes it shortly before it expires).
api.interceptors.request.use(async (config) => {
  // The app can now draw before Firebase has restored the saved sign-in (see authSlice), so a request made
  // in that first moment waits for it rather than going out without a token.
  await auth.authStateReady();
  const user = auth.currentUser;
  if (user) config.headers.Authorization = `Bearer ${await user.getIdToken()}`;
  return config;
});

// A rejected token mid-session (account suspended or removed) means: back to the sign-in screen.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && auth.currentUser) signOut(auth);
    return Promise.reject(error);
  }
);

/** A readable message for a failed API call. */
export const errorMessage = (error, fallback = "Something went wrong. Please try again.") => {
  if (error?.response?.data?.message) return error.response.data.message;
  if (axios.isAxiosError(error) && !error.response) {
    return "Could not reach the server. Check your connection and try again.";
  }
  return fallback;
};
