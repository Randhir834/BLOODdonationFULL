import { App as CapacitorApp } from "@capacitor/app";
import { Geolocation } from "@capacitor/geolocation";
import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { updateLocation } from "./locationApi";

const PUSH_INTERVAL_MS = 45_000;

/**
 * Mounted once, from AppShell: while the signed-in user has location sharing on, periodically
 * reports this device's position, only while the app is in the foreground (see the "foreground-only"
 * tracking decision — there is no background service, no continuous GPS lock).
 *
 * This never requests permission itself; a permission prompt only ever happens when someone
 * explicitly turns sharing on from the profile screen (see LocationPermissionCard). If permission
 * is missing here (e.g. revoked later in device settings), a tick is silently skipped.
 */
export function useLocationTracking() {
  const sharing = !!useSelector((state) => state.auth.user?.locationSharing);
  const foreground = useRef(true);

  useEffect(() => {
    if (!sharing) return undefined;

    let cancelled = false;
    const push = async () => {
      if (cancelled || !foreground.current) return;
      try {
        const permission = await Geolocation.checkPermissions();
        if (permission.location !== "granted" && permission.coarseLocation !== "granted") return;
        const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15_000 });
        if (cancelled) return;
        await updateLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy || undefined,
        });
      } catch {
        // A missed update is not worth surfacing; the next tick (or the next foreground) tries again.
      }
    };

    push();
    const timer = setInterval(push, PUSH_INTERVAL_MS);

    const onVisibility = () => {
      foreground.current = document.visibilityState === "visible";
      if (foreground.current) push();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const listenerHandle = CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      foreground.current = isActive;
      if (isActive) push();
    });

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      listenerHandle.then((handle) => handle.remove()).catch(() => {});
    };
  }, [sharing]);
}
