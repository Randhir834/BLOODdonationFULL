import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "../components/Layout";
import { useAuth } from "../features/auth/authContext";
import LoginPage from "../features/auth/LoginPage";

// Each screen is its own download, so signing in only loads what it shows.
const DashboardPage = lazy(() => import("../features/dashboard/DashboardPage"));
const UsersPage = lazy(() => import("../features/users/UsersPage"));
const InventoryPage = lazy(() => import("../features/inventory/InventoryPage"));
const RequestsPage = lazy(() => import("../features/requests/RequestsPage"));
const LocationsPage = lazy(() => import("../features/locations/LocationsPage"));
const AdminsPage = lazy(() => import("../features/admins/AdminsPage"));
const AuditLogPage = lazy(() => import("../features/audit/AuditLogPage"));

export default function App() {
  const { loading, admin } = useAuth();

  if (loading) return <div className="center">Loading…</div>;
  if (!admin) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <Suspense fallback={<div className="center">Loading…</div>}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="requests" element={<RequestsPage />} />
          <Route path="locations" element={<LocationsPage />} />
          <Route path="admins" element={<AdminsPage />} />
          <Route path="audit" element={<AuditLogPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
