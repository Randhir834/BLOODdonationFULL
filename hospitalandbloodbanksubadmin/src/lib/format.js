export { ROLE_LABEL } from "./constants";

export const fmtNum = (n) => Number(n || 0).toLocaleString();
export const fmtMl = (n) => `${fmtNum(n)} ML`;

export const fmtDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "-";

/** Compact "Sep 21, 6:18 PM" for narrow tables. */
export const fmtShort = (iso) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "-";

/** "2026-09-22" -> "22 Sep" */
export const fmtDay = (key) =>
  new Date(`${key}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });

/** An ISO date-time, as just a date: "22 Sep 2026". */
export const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : "-";

/** Whole days from now until `iso` (negative once past), or null. */
export const daysUntil = (iso, now = new Date()) =>
  iso ? Math.ceil((new Date(iso) - now) / 86_400_000) : null;

/** "in 3 days", "tomorrow", "today", "2 days ago" for an expiry date. */
export const fmtRelativeDay = (iso, now = new Date()) => {
  const days = daysUntil(iso, now);
  if (days === null) return "-";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
};

/** The display name of a user, whichever role they have. */
export const nameOf = (user) =>
  user ? user.name || user.hospitalName || user.organisationName || user.phone || "-" : "Deleted account";

/** The name an organisation goes by: its hospital or blood bank name. */
export const orgName = (user) => user?.hospitalName || user?.organisationName || user?.phone || "";

/** "Just now", "12 min ago", "3 h ago", "5 days ago", or the date once it is older than a month. */
export const fmtAgo = (iso, now = new Date()) => {
  if (!iso) return "-";
  const minutes = Math.round((now - new Date(iso)) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 31) return `${days} ${days === 1 ? "day" : "days"} ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

/** +919876543210 -> "+91 98765 43210" (India) or the number as is. */
export const formatPhone = (phone) => {
  const match = /^\+91(\d{5})(\d{5})$/.exec(phone || "");
  return match ? `+91 ${match[1]} ${match[2]}` : phone || "";
};

/** A calendar day (YYYY-MM-DD) n days from today, for date inputs' min / max. */
export const dayFromToday = (days) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
