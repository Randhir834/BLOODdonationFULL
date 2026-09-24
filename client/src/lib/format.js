import { ROLE_LABEL } from "./constants";
import { COUNTRIES } from "./phone";

export { BLOOD_GROUPS } from "./constants";
export { ROLE_LABEL };

export const fmtNum = (n) => Number(n || 0).toLocaleString();

export const fmtTime = (iso) =>
  iso ? new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "";

/** "21 Sep, 6:18 PM" */
export const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

export const fmtDay = (iso) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";

/** "Today", "Yesterday", "21 September" (with the year when it is not this year) */
export const dayHeading = (iso, now = new Date()) => {
  const date = new Date(iso);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    ...(date.getFullYear() !== now.getFullYear() && { year: "numeric" }),
  });
};

/** Newest-first rows -> [{ heading, rows }], one group per day. */
export const groupByDay = (rows) => {
  const groups = [];
  rows.forEach((row) => {
    const heading = dayHeading(row.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.heading === heading) last.rows.push(row);
    else groups.push({ heading, rows: [row] });
  });
  return groups;
};

/** The display name of a user, whichever role they have. */
export const nameOf = (user) =>
  user ? user.name || user.hospitalName || user.organisationName || user.phone || "Unknown" : "Deleted user";

export const initialOf = (user) => (nameOf(user).trim()[0] || "?").toUpperCase();

/**
 * "+917779993958" -> "+91 77799 93958", for whichever of the app's supported countries (see lib/phone.js)
 * the number is from, not only India. Falls back to the raw E.164 string for an unrecognised country
 * code or a number of the wrong length for its country.
 */
export const formatPhone = (e164) => {
  const value = e164 || "";
  const country = Object.values(COUNTRIES).find((candidate) => value.startsWith(candidate.code));
  if (!country) return value;

  const national = value.slice(country.code.length);
  if (national.length !== country.digits) return value;

  const mid = Math.ceil(national.length / 2);
  return `${country.code} ${national.slice(0, mid)} ${national.slice(mid)}`;
};

/** "Just now", "12 min ago", "3 h ago", "Yesterday", or "21 Sep". */
export const fmtAgo = (iso, now = new Date()) => {
  if (!iso) return "";
  const then = new Date(iso);
  const minutes = Math.round((now - then) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return dayHeading(iso, now) === "Yesterday"
    ? "Yesterday"
    : then.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

/** Whole days from `now` until `iso` (0 = today, negative = already past). */
export const daysUntil = (iso, now = new Date()) => Math.ceil((new Date(iso) - now) / 86_400_000);
