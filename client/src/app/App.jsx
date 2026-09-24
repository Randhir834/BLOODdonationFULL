import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "../components/AppShell";
import RoleOnly from "../components/RoleOnly";
import Splash from "../components/Splash";
import Toaster from "../components/Toaster";
import { ROLES } from "../lib/constants";

// Each screen is its own download, so the first paint only loads what it shows.
const loadHome = () => import("../features/inventory/HomePage");
const loadRequests = () => import("../features/requests/RequestsPage");
const loadProfile = () => import("../features/profile/ProfilePage");
const LoginPage = lazy(() => import("../features/auth/LoginPage"));
const HomePage = lazy(loadHome);
const RecordsPage = lazy(() => import("../features/inventory/RecordsPage"));
const RequestsPage = lazy(loadRequests);
const PeoplePage = lazy(() => import("../features/directory/PeoplePage"));
const ProfilePage = lazy(loadProfile);
const NearbyMapPage = lazy(() => import("../features/location/NearbyMapPage"));
const MyCampsPage = lazy(() => import("../features/camps/MyCampsPage"));

/**
 * Starts downloading the home screen right away, in step with Firebase restoring the sign-in, instead of
 * only once that is finished; then, a moment later, the two screens people go to next, so switching tabs
 * does not wait on a download either.
 */
export const preloadScreens = () => {
  loadHome();
  setTimeout(() => {
    loadRequests();
    loadProfile();
  }, 1500);
};

const { ORGANISATION, DONOR, HOSPITAL } = ROLES;

export default function App() {
  return (
    <>
      <Toaster />
      <Suspense fallback={<Splash />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route
              path="records"
              element={
                <RoleOnly roles={[ORGANISATION]}>
                  <RecordsPage />
                </RoleOnly>
              }
            />
            <Route
              path="requests"
              element={
                <RoleOnly roles={[ORGANISATION, HOSPITAL, DONOR]}>
                  <RequestsPage />
                </RoleOnly>
              }
            />
            <Route
              path="donors"
              element={
                <RoleOnly roles={[ORGANISATION]}>
                  <PeoplePage kind="donors" />
                </RoleOnly>
              }
            />
            <Route
              path="hospitals"
              element={
                <RoleOnly roles={[ORGANISATION]}>
                  <PeoplePage kind="hospitals" />
                </RoleOnly>
              }
            />
            <Route
              path="organisations"
              element={
                <RoleOnly roles={[DONOR, HOSPITAL]}>
                  <PeoplePage kind="organisations" />
                </RoleOnly>
              }
            />
            <Route path="map" element={<NearbyMapPage />} />
            <Route
              path="my-camps"
              element={
                <RoleOnly roles={[ORGANISATION]}>
                  <MyCampsPage />
                </RoleOnly>
              }
            />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
