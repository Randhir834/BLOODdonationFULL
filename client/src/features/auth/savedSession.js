// The last signed-in profile, kept on the device so the app can draw the home screen straight away on
// launch instead of waiting for Firebase and a round trip to the server to say who is signed in. It is
// only a starting point: the real answer arrives right behind it (see initAuth) and replaces it, and it is
// removed when the person signs out. The server still checks every request, so this never grants access.
const KEY = "bb.session";

export const loadSavedUser = () => {
  try {
    const user = JSON.parse(localStorage.getItem(KEY));
    return user && typeof user._id === "string" ? user : null;
  } catch {
    return null;
  }
};

export const saveUser = (user) => {
  try {
    if (user) localStorage.setItem(KEY, JSON.stringify(user));
    else localStorage.removeItem(KEY);
  } catch {
    // storage unavailable: the app just loads the slow way next time
  }
};
