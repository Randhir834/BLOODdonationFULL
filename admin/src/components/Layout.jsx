import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../features/auth/authContext";
import { useApi } from "../hooks/useApi";
import { BrandMark, NavIcon } from "./Icons";
import { StatusPill } from "./Status";

const LINKS = [
  { to: "/", label: "Dashboard", end: true, icon: "grid" },
  { to: "/users", label: "Users", icon: "users" },
  { to: "/inventory", label: "Blood records", icon: "drop" },
  { to: "/requests", label: "Blood requests", icon: "inbox" },
  { to: "/locations", label: "Locations", icon: "map" },
  { to: "/admins", label: "Admins", icon: "shield" },
  { to: "/audit", label: "Activity log", icon: "list" },
];

const SYSTEM_POLL_MS = 30_000;

/** One glance: is everything the app depends on up? Rechecked periodically for the whole session, not
 * just once at login, since the header stays mounted across every page. */
function SystemPill() {
  const { data, error } = useApi("/system", undefined, SYSTEM_POLL_MS);
  if (error) return <StatusPill kind="critical">System check failed</StatusPill>;
  if (!data) return null;
  const { firestore, auth } = data.system;
  return firestore.ok && auth.ok ? (
    <StatusPill kind="good">All systems working</StatusPill>
  ) : (
    <StatusPill kind="critical">{!firestore.ok ? "Database is down" : "Sign-in service is down"}</StatusPill>
  );
}

export default function Layout() {
  const { admin, logout } = useAuth();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <BrandMark />
          Blood Bank Admin
        </div>
        <nav className="nav">
          {LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end}>
              <NavIcon name={link.icon} size={18} />
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <SystemPill />
          <div className="topbar-right">
            <span className="who" title={admin.email}>
              {admin.email}
            </span>
            <button type="button" className="btn btn-small" onClick={logout}>
              <NavIcon name="logout" size={15} />
              Sign out
            </button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
