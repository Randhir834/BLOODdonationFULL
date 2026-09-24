import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";

/** Keeps a screen to the roles that use it, everyone else goes back to their first tab. */
export default function RoleOnly({ roles, children }) {
  const { user } = useSelector((state) => state.auth);
  return roles.includes(user?.role) ? children : <Navigate to="/" replace />;
}
