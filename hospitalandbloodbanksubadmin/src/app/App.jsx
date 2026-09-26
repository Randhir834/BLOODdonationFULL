import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { LoadError, PageLoading } from "../components/Feedback";
import Layout from "../components/Layout";
import { useAuth } from "../features/auth/authContext";
import RegisterDetailsPage from "../features/auth/RegisterDetailsPage";
import SignInPage from "../features/auth/SignInPage";
import StatusPage from "../features/auth/StatusPage";

// Each screen is its own download, so signing in only loads what it shows.
const DashboardPage = lazy(() => import("../features/dashboard/DashboardPage"));
const StockPage = lazy(() => import("../features/stock/StockPage"));
const MovementsPage = lazy(() => import("../features/movements/MovementsPage"));
const RequestsPage = lazy(() => import("../features/requests/RequestsPage"));
const RequestDetailPage = lazy(() => import("../features/requests/RequestDetailPage"));
const NotificationsPage = lazy(() => import("../features/notifications/NotificationsPage"));
const ProfilePage = lazy(() => import("../features/profile/ProfilePage"));
const ActivityPage = lazy(() => import("../features/activity/ActivityPage"));

export default function App() {
  const { loading, signedIn, user, loadError, reload, logout } = useAuth();

  if (loading) return <PageLoading />;

  if (!signedIn) {
    return (
      <Routes>
        <Route path="/register" element={<SignInPage mode="register" />} />
        <Route path="*" element={<SignInPage mode="login" />} />
      </Routes>
    );
  }

  // Signed in, but the account could not be read (the server is down): not the same as being signed out.
  if (loadError && user === null) {
    return (
      <div className="status-page">
        <div className="status-card">
          <LoadError message={loadError} hasData={false} onRetry={reload} />
          <div className="status-actions">
            <button type="button" className="btn" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // A verified number that has not registered an organisation yet.
  if (user === null) return <RegisterDetailsPage />;

  // Waiting for an admin's decision, refused, or suspended.
  if (user.verification !== "approved" || user.status === "suspended") return <StatusPage />;

  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="stock" element={<StockPage />} />
          <Route path="movements" element={<MovementsPage />} />
          <Route path="requests" element={<RequestsPage />} />
          <Route path="requests/:id" element={<RequestDetailPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
