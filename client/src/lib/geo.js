const EARTH_RADIUS_KM = 6371;
const toRad = (deg) => (deg * Math.PI) / 180;

/** Straight-line distance in km between two { lat, lng } points. */
export const distanceKm = (a, b) => {
  if (!a || !b) return null;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

/** "800 m" under a km, "4.2 km" otherwise. */
export const fmtDistance = (km) => {
  if (km === null || km === undefined) return "";
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
};

/** Sorts entities with a `.location` by distance from `origin`; those without one sort last. */
export const sortByDistance = (rows, origin) =>
  [...rows].sort((a, b) => {
    const da = origin && a.location ? distanceKm(origin, a.location) : null;
    const db = origin && b.location ? distanceKm(origin, b.location) : null;
    if (da === null && db === null) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
  });
