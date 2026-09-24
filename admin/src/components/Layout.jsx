import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../features/auth/authContext";
import { useApi } from "../hooks/useApi";
import { BrandMark, NavIcon } from "./Icons";
import { StatusPill } from "./Status";

const GROUPS = [
  {
    title: "Overview",
    links: [{ to: "/", label: "Dashboard", end: true, icon: "grid" }],
  },
  {
    title: "Manage",
    links: [
      { to: "/users", label: "Users", icon: "users" },
      { to: "/inventory", label: "Blood records", icon: "drop" },
      { to: "/requests", label: "Blood requests", icon: "inbox" },
      { to: "/locations", label: "Locations", icon: "map" },
    ],
  },
  {
    title: "Administration",
    links: [
      { to: "/admins", label: "Admins", icon: "shield" },
      { to: "/audit", label: "Activity log", icon: "list" },
    ],
  },
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
  const [menuOpen, setMenuOpen] = useState(false);

  // Choosing a page closes the menu (see the links below); Escape closes it too.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (event) => event.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div className="shell">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`.trim()} aria-label="Menu">
        <div className="brand">
          <BrandMark />
          <span>
            Blood Bank
            <small>Admin</small>
          </span>
        </div>
        <nav className="nav" aria-label="Main">
          {GROUPS.map((group) => (
            <div className="nav-section" key={group.title} role="group" aria-label={group.title}>
              <div className="nav-group" aria-hidden="true">
                {group.title}
              </div>
              {group.links.map((link) => (
                <NavLink key={link.to} to={link.to} end={link.end} onClick={() => setMenuOpen(false)}>
                  <NavIcon name={link.icon} size={18} />
                  {link.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="account">
          <span className="avatar" aria-hidden="true">
            {(admin.email || "?")[0].toUpperCase()}
          </span>
          <div className="account-text">
            <div className="account-email" title={admin.email}>
              {admin.email}
            </div>
            <div className="account-role">Administrator</div>
          </div>
          <button type="button" className="icon-btn" onClick={logout} aria-label="Sign out" title="Sign out">
            <NavIcon name="logout" size={18} />
          </button>
        </div>
      </aside>
      {menuOpen && (
        <button type="button" className="scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
      )}

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="icon-btn menu-btn"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <NavIcon name="menu" size={22} />
            </button>
            <div className="brand">
              <BrandMark size={24} />
              Blood Bank
            </div>
          </div>
          <SystemPill />
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
