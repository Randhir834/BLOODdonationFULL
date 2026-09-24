import { Suspense, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { NAVIGATION } from "../app/navigation";
import ApprovalPending from "../features/auth/ApprovalPending";
import { useLocationTracking } from "../features/location/useLocationTracking";
import { awaitingApproval } from "../lib/approval";
import { initialOf, nameOf } from "../lib/format";
import { startRealtime, stopRealtime } from "../lib/realtime";
import { BrandMark, Icon } from "./Icon";
import MoreSheet from "./MoreSheet";
import { Loading } from "./States";
import Splash from "./Splash";

const matches = (tab, pathname) => (tab.end ? pathname === tab.to : pathname.startsWith(tab.to));

/**
 * Everything after sign-in: needs a verified phone AND a profile, otherwise back to the sign-in page.
 * Hospitals and blood banks also need an admin's approval.
 */
export default function AppShell() {
  const { loading, signedIn, user } = useSelector((state) => state.auth);
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  useLocationTracking();

  // One realtime connection for the whole app, open only while actually signed in.
  useEffect(() => {
    if (!signedIn || !user) return undefined;
    startRealtime();
    return stopRealtime;
  }, [signedIn, user]);

  if (loading) return <Splash />;
  if (!signedIn || !user) return <Navigate to="/login" replace />;
  // A hospital or blood bank sees nothing of the app until an admin has approved it.
  if (awaitingApproval(user)) return <ApprovalPending user={user} />;

  const tabs = NAVIGATION[user.role] || [];
  const current = tabs.find((tab) => matches(tab, pathname));
  const secondary = tabs.filter((tab) => tab.secondary);
  const moreActive = secondary.some((tab) => matches(tab, pathname));

  return (
    <div className="app">
      <nav className="tabbar" aria-label="Main">
        <div className="brand">
          <BrandMark />
          Blood Bank
        </div>
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              [
                "tab",
                isActive && "active",
                tab.secondary && "tab-secondary",
                tab.pin === "bottom" && "tab-end",
              ]
                .filter(Boolean)
                .join(" ")
            }
          >
            <Icon name={tab.icon} />
            <span>{tab.label}</span>
          </NavLink>
        ))}
        {secondary.length > 0 && (
          <button
            type="button"
            className={`tab tab-more ${moreActive ? "active" : ""}`.trim()}
            aria-haspopup="dialog"
            onClick={() => setMoreOpen(true)}
          >
            <Icon name="more" />
            <span>More</span>
          </button>
        )}
      </nav>

      <div className="content">
        <header className="appbar">
          <div className="appbar-inner">
            <div className="appbar-text">
              <h1>{current?.title || "Blood Bank"}</h1>
              {pathname === "/" && <p className="appbar-sub">{nameOf(user)}</p>}
            </div>
            <Link className="appbar-profile" to="/profile" aria-label="Your profile">
              {initialOf(user)}
            </Link>
          </div>
        </header>
        <main className="screen">
          <Suspense fallback={<Loading />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {moreOpen && <MoreSheet items={secondary} pathname={pathname} onClose={() => setMoreOpen(false)} />}
    </div>
  );
}
