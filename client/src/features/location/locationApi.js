import { api } from "../../lib/api";

/** Reports where this device currently is. Turns sharing on the first time it succeeds. */
export const updateLocation = (coords) =>
  api.patch("/location", coords).then((response) => response.data.location);

/** Turns live location sharing on or off. Off also deletes the stored location, server-side. */
export const setLocationSharing = (enabled) =>
  api.patch("/location/sharing", { enabled }).then((response) => response.data.locationSharing);

/** Hospitals, blood banks and active camps that are sharing their location. Never includes donors. */
export const fetchNearby = () => api.get("/location/nearby").then((response) => response.data);
