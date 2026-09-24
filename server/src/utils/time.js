import { env } from "../config/env.js";

// The admin dashboard reports days in this time zone.
const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: env.ADMIN_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Date -> "YYYY-MM-DD" in the admin time zone. */
export const dayKey = (date) => dayFormat.format(date);
