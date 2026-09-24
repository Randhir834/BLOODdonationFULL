import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../features/auth/authContext";
import { useApi } from "../hooks/useApi";
import { useRealtime } from "../hooks/useRealtime";
import { ROLE_LABEL } from "../lib/constants";
import { orgName } from "../lib/format";
import { notify } from "../lib/notify";
import { BrandMark, NavIcon } from "./Icons";

const groupsFor = (role) => [
  { title: "Overview", links: [{ to: "/", label: "Dashboard", end: true, icon: "grid" }] },
  {
    title: "Operations",
    links: [
      { to: "/requests", label: "Blood requests", icon: "clipboard", count: "requests" },
      {
        to: "/stock",
        label: "Blood stock",
        icon: "drop",
        count: role === "hospital" ? "deliveries" : undefined,
      },
      { to: "/movements", label: "Movement history", icon: "list" },
    ],
  },
  {
    title: "Organisation",
    links: [
      { to: "/notifications", label: "Notifications", icon: "bell", count: "unread" },
      { to: "/profile", label: "Profile", icon: "building" },
      { to: "/activity", label: "Activity log", icon: "activity" },
    ],
  },
];

/**
 * What needs a person, for the numbers beside the menu items and on the bell. One small request each, kept
 * fresh by the live feed. Failing quietly is right here: a missing number is not worth an error message.
 */
function useCounts(role) {
  const unread = useApi("/notifications", { limit: 5 });
  const requests = useApi("/requests", { needsAction: "1", pageSize: 1 });
  const hospital = role === "hospital";
  const deliveries = useApi("/shipments", { status: "pending" }, { enabled: hospital });
  useRealtime("notifications", unread.reload);
  useRealtime("requests", requests.reload);
  useRealtime("stock", deliveries.reload);

  // A new unread notification while the site is open says so, once. The first load is not "new".
  const seen = useRef(null);
  useEffect(() => {
    const list = unread.data?.notifications;
    if (!list) return;
    const newest = list[0]?.createdAt ?? "";
    if (seen.current !== null) {
      const fresh = list.filter((item) => !item.read && item.createdAt > seen.current);
      if (fresh.length)
        notify.info(fresh.length === 1 ? fresh[0].title : `${fresh.length} new notifications`);
    }
    seen.current = newest;
  }, [unread.data]);

  return {
    unread: unread.data?.unread ?? 0,
    requests: requests.data?.stats?.needsAction ?? 0,
    deliveries: deliveries.data?.shipments?.length ?? 0,
    latest: unread.data?.notifications ?? [],
  };
}

export default function Layout() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const counts = useCounts(user.role);

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
            <small>{ROLE_LABEL[user.role]} portal</small>
          </span>
        </div>
        <nav className="nav" aria-label="Main">
          {groupsFor(user.role).map((group) => (
            <div className="nav-section" key={group.title} role="group" aria-label={group.title}>
              <div className="nav-group" aria-hidden="true">
                {group.title}
              </div>
              {group.links.map((link) => {
                const count = link.count ? counts[link.count] : 0;
                return (
                  <NavLink key={link.to} to={link.to} end={link.end} onClick={() => setMenuOpen(false)}>
                    <NavIcon name={link.icon} size={18} />
                    {link.label}
                    {count > 0 && (
                      <span className="nav-count" aria-label={`${count} waiting`}>
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="account">
          <span className="avatar" aria-hidden="true">
            {(orgName(user)[0] || "?").toUpperCase()}
          </span>
          <div className="account-text">
            <div className="account-email" title={orgName(user)}>
              {orgName(user)}
            </div>
            <div className="account-role">{user.city || ROLE_LABEL[user.role]}</div>
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
          <div className="topbar-right">
            <div className="org-chip">
              <b>{orgName(user)}</b>
              <span>{ROLE_LABEL[user.role]}</span>
            </div>
            <Link
              to="/notifications"
              className="icon-btn bell"
              aria-label={counts.unread > 0 ? `Notifications, ${counts.unread} unread` : "Notifications"}
            >
              <NavIcon name="bell" size={20} />
              {counts.unread > 0 && (
                <span className="nav-count">{counts.unread > 99 ? "99+" : counts.unread}</span>
              )}
            </Link>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
