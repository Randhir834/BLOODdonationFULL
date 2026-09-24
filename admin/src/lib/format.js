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

/** An ISO date-time, as just a date: "22 Sep 2026". Unlike fmtDay, this takes a full timestamp. */
export const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : "-";

/** The display name of a user, whichever role they have. */
export const nameOf = (user) =>
  user ? user.name || user.hospitalName || user.organisationName || user.phone || "-" : "Deleted user";

export const ACTION_LABEL = {
  "user.update": "Edited a user",
  "user.suspend": "Suspended a user",
  "user.reactivate": "Reactivated a user",
  "user.delete": "Deleted a user",
  "user.approve": "Approved a registration",
  "user.reject": "Rejected a registration",
  "user.register": "Signed up",
  "inventory.add": "Added blood",
  "inventory.issue": "Issued blood",
  "inventory.discard": "Discarded a unit",
  "inventory.delete": "Deleted a blood record",
  "request.create": "Requested blood",
  "request.fulfil": "Fulfilled a blood request",
  "request.reject": "Rejected a blood request",
  "request.cancel": "Cancelled a blood request",
  "admin.create": "Added an admin",
  "admin.delete": "Removed an admin",
};
