import {
  APPROVAL_ROLES,
  REQUEST_STATUS_LABEL,
  UNIT_STATUS_LABEL,
  VERIFICATION_LABEL,
} from "../lib/constants";
import { ROLE_LABEL } from "../lib/format";

// Small inline icons, they always come with a text label next to them.
const PATHS = {
  critical:
    "M12 2a10 10 0 100 20 10 10 0 000-20zm3.5 12.1l-1.4 1.4L12 13.4l-2.1 2.1-1.4-1.4 2.1-2.1-2.1-2.1 1.4-1.4 2.1 2.1 2.1-2.1 1.4 1.4-2.1 2.1z",
  warning: "M12 2L1 21h22L12 2zm1 15h-2v-2h2v2zm0-4h-2V9h2v4z",
  info: "M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z",
  good: "M12 2a10 10 0 100 20 10 10 0 000-20zm-2 15l-5-5 1.4-1.4L10 14.2l7.6-7.6L19 8l-9 9z",
};

export function Icon({ name, size = 16 }) {
  return (
    <svg className={`icon icon-${name}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={PATHS[name]} fill="currentColor" />
    </svg>
  );
}

/** Status = a coloured dot + a word, never colour alone. */
export function StatusPill({ kind, children }) {
  return (
    <span className={`pill pill-${kind}`}>
      <span className="dot" aria-hidden="true" />
      {children}
    </span>
  );
}

/** A role is just text: it does not need a box. */
export function RoleBadge({ role }) {
  return <span className="role-text">{ROLE_LABEL[role] || role}</span>;
}

const APPROVAL_KIND = { approved: "good", pending: "warning", rejected: "critical" };

/** Whether an admin has approved a hospital or blood bank. Donors do not need approval. */
export function ApprovalStatus({ role, verification }) {
  if (!APPROVAL_ROLES.includes(role)) return <span className="hint">Not needed</span>;
  return (
    <StatusPill kind={APPROVAL_KIND[verification] || "info"}>
      {VERIFICATION_LABEL[verification] || verification}
    </StatusPill>
  );
}

export function AccountStatus({ status }) {
  return status === "suspended" ? (
    <StatusPill kind="critical">Suspended</StatusPill>
  ) : (
    <StatusPill kind="good">Active</StatusPill>
  );
}

const UNIT_KIND = { available: "good", issued: "info", discarded: "critical", expired: "critical" };

/**
 * A blood unit's lifecycle, for an "in" record. `record.status` is "available" even past its expiry
 * date until someone discards it (or `npm run sweep-expired` runs), so this checks the date itself
 * to show "Expired" instead. An "out" record, and a record from before units existed, show nothing.
 */
export function UnitStatus({ record }) {
  if (!record.status || record.status === "legacy") return <span className="hint">-</span>;
  const expired =
    record.status === "available" && record.expiresAt && record.expiresAt < new Date().toISOString();
  const status = expired ? "expired" : record.status;
  return <StatusPill kind={UNIT_KIND[status] || "info"}>{UNIT_STATUS_LABEL[status] || status}</StatusPill>;
}

const REQUEST_KIND = {
  pending: "warning",
  fulfilled: "good",
  rejected: "critical",
  cancelled: "info",
  expired: "critical",
};

/**
 * A blood request's lifecycle. `request.status` stays "pending" even past its needed-by date until a
 * blood bank answers it, so this checks the date itself to show "Expired" instead.
 */
export function RequestStatus({ request }) {
  const expired =
    request.status === "pending" && request.requiredAt && request.requiredAt < new Date().toISOString();
  const status = expired ? "expired" : request.status;
  return (
    <StatusPill kind={REQUEST_KIND[status] || "info"}>{REQUEST_STATUS_LABEL[status] || status}</StatusPill>
  );
}
