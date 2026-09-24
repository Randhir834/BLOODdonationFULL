import { ROLES } from "./constants";

export const VERIFICATION = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
});

// Hospitals and blood banks are checked by an admin before they can use the app. Donors are not.
export const APPROVAL_ROLES = Object.freeze([ROLES.HOSPITAL, ROLES.ORGANISATION]);

/** True when the person has a profile but an admin has not approved it (yet, or at all). */
export const awaitingApproval = (user) =>
  Boolean(user) &&
  APPROVAL_ROLES.includes(user.role) &&
  (user.verification ?? VERIFICATION.APPROVED) !== VERIFICATION.APPROVED;
