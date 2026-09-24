import { createContext, useContext } from "react";

export const AuthContext = createContext(null);

/**
 * {
 *   loading,   // true until Firebase and the server have said who is signed in
 *   signedIn,  // a phone number is verified
 *   user,      // the hospital / blood bank account, or null when the number has not registered yet
 *   notice,    // why the sign-in screen came back on its own
 *   loadError, // the account could not be loaded (server down), not the same as being signed out
 *   register(profile), reload(), logout()
 * }
 */
export const useAuth = () => useContext(AuthContext);
