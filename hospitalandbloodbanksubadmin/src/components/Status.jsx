import {
  REQUEST_PRIORITY_LABEL,
  REQUEST_STATUS_LABEL,
  UNIT_STATE_LABEL,
  VERIFICATION_LABEL,
} from "../lib/constants";

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

const VERIFICATION_KIND = { approved: "good", pending: "warning", rejected: "critical" };

export function VerificationStatus({ verification }) {
  return (
    <StatusPill kind={VERIFICATION_KIND[verification] || "info"}>
      {VERIFICATION_LABEL[verification] || verification}
    </StatusPill>
  );
}

const UNIT_KIND = {
  available: "good",
  issued: "info",
  discarded: "critical",
  expired: "critical",
  legacy: "info",
};

/** A blood unit's state, from the `state` the API works out (an available unit past its expiry is "expired"). */
export function UnitState({ unit }) {
  if (unit.state === "available" && unit.expiringSoon)
    return <StatusPill kind="warning">Expiring soon</StatusPill>;
  return (
    <StatusPill kind={UNIT_KIND[unit.state] || "info"}>
      {UNIT_STATE_LABEL[unit.state] || unit.state}
    </StatusPill>
  );
}

const REQUEST_KIND = {
  pending: "warning",
  fulfilled: "good",
  rejected: "critical",
  cancelled: "info",
  expired: "critical",
};

/** A request's lifecycle. A pending request past its needed-by date reads "Expired" (the API says so with `expired`). */
export function RequestState({ request }) {
  const status = request.expired ? "expired" : request.status;
  return (
    <StatusPill kind={REQUEST_KIND[status] || "info"}>{REQUEST_STATUS_LABEL[status] || status}</StatusPill>
  );
}

/** Only urgent and emergency requests are marked: a normal one needs no label. */
export function PriorityFlag({ priority }) {
  if (!priority || priority === "normal") return null;
  return <span className={`flag flag-${priority}`}>{REQUEST_PRIORITY_LABEL[priority] || priority}</span>;
}

const STOCK_KIND = { out: "critical", low: "warning", ok: "good" };
const STOCK_LABEL = { out: "Out of stock", low: "Running low", ok: "Enough" };

export function StockLevel({ status }) {
  return <StatusPill kind={STOCK_KIND[status] || "info"}>{STOCK_LABEL[status] || status}</StatusPill>;
}
