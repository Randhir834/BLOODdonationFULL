import { Geolocation } from "@capacitor/geolocation";

/**
 * Asks for location permission in a way that works both natively and on the web. On Android/iOS,
 * `requestPermissions()` shows the system dialog. On the web there is no separate "request" call —
 * `requestPermissions()` is not implemented there, and a browser only ever shows its own permission
 * prompt when a position is actually asked for — so this falls back to `getCurrentPosition()`, which
 * triggers that prompt. Resolves to true once permission is granted, false if denied or unavailable.
 */
export const ensureLocationPermission = async () => {
  try {
    const permission = await Geolocation.requestPermissions();
    if (permission.location === "granted" || permission.coarseLocation === "granted") return true;
    if (permission.location === "denied") return false;
  } catch {
    // requestPermissions() is unimplemented on the web platform; fall through below.
  }
  try {
    await Geolocation.getCurrentPosition({ timeout: 15_000 });
    return true;
  } catch {
    return false;
  }
};
