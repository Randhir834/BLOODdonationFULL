import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../features/auth/authSlice";
import { saveUser } from "../features/auth/savedSession";
import { clearCache } from "../lib/dataCache";

export const store = configureStore({
  reducer: { auth: authReducer },
});

// Remember who is signed in for the next launch, and never let one person's cached screens outlive them:
// the cached data is wiped when the signed-in person signs out or changes.
let currentId = store.getState().auth.user?._id ?? null;
store.subscribe(() => {
  const { loading, user } = store.getState().auth;
  if (loading) return;
  saveUser(user);
  const id = user?._id ?? null;
  if (id !== currentId) {
    if (currentId !== null) clearCache();
    currentId = id;
  }
});
