import { createContext, useContext } from "react";

export const AuthContext = createContext(null);

/** { loading, admin, notice, login(email, password), logout() } */
export const useAuth = () => useContext(AuthContext);
