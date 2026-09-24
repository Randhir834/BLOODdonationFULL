import { z } from "zod";
import { LIMITS } from "../constants/index.js";
import { geoPoint } from "./common.js";

export const updateLocationBody = geoPoint.extend({
  // Metres of GPS uncertainty, as reported by the device. Optional: the web geolocation API always
  // sends one, a coarse fallback may not.
  accuracy: z.number().positive().max(LIMITS.MAX_LOCATION_ACCURACY_M).optional(),
});

export const locationSharingBody = z.object({
  enabled: z.boolean({ error: "enabled must be true or false" }),
});
