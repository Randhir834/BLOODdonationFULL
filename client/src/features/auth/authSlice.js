import { createSlice } from "@reduxjs/toolkit";
import { loadSavedUser } from "./savedSession";

// `loading` stays true until Firebase has told us whether someone is signed in, unless this device
// remembers who was signed in last time, in which case the app draws at once and Firebase confirms.
// `signedIn && !user` means the phone is verified but the profile is not created yet.
const savedUser = loadSavedUser();
const initialState = savedUser
  ? { loading: false, signedIn: true, user: savedUser }
  : { loading: true, signedIn: false, user: null };

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setSession(state, { payload }) {
      state.loading = false;
      state.signedIn = payload.signedIn;
      state.user = payload.user;
    },
  },
});

export const { setSession } = authSlice.actions;
export default authSlice.reducer;
