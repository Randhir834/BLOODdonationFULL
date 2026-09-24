import { Icon } from "./Icon";

/** Placeholder rows shaped like the real ones, so nothing jumps when the data arrives. */
export function Loading({ rows = 4, round = false }) {
  return (
    <div className="group" role="status" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <div className="skel" key={index}>
          <i className={round ? "skel-round" : "skel-tag"} />
          <div className="skel-lines">
            <i className="skel-line-1" />
            <i className="skel-line-2" />
          </div>
          {!round && <i className="skel-amount" />}
        </div>
      ))}
    </div>
  );
}

/** Nothing to show yet. Say why, and offer the obvious next step when there is one. */
export function Empty({ icon = "drop", title, children, action, quiet = false }) {
  return (
    <div className={`empty ${quiet ? "is-quiet" : ""}`.trim()}>
      <Icon name={icon} />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

/** A short message inside a form or above a list. `tone`: error (default), warning, success or info. */
export function Notice({ tone = "error", title, children, action, role, className = "" }) {
  const icon = { error: "alertCircle", warning: "alertTriangle", success: "checkCircle", info: "info" }[tone];
  return (
    <div
      className={`notice notice-${tone} ${className}`.trim()}
      role={role || (tone === "error" ? "alert" : "status")}
    >
      <Icon name={icon} />
      <div className="notice-body">
        {title && <div className="notice-title">{title}</div>}
        {children && <div className="notice-text">{children}</div>}
      </div>
      {action && <div className="notice-action">{action}</div>}
    </div>
  );
}

/** A failed request shown above data that is still on screen (or above an empty list). */
export function ErrorBanner({ message, onRetry, className = "" }) {
  if (!message) return null;
  return (
    <Notice
      className={className}
      action={
        onRetry && (
          <button type="button" className="link-btn" onClick={onRetry}>
            Retry
          </button>
        )
      }
    >
      {message}
    </Notice>
  );
}

/**
 * A screen's load failed: a banner when older data is still showing under it, and a full "could not load"
 * state when there is nothing to show at all.
 */
export function LoadError({ error, hasData, onRetry, className = "" }) {
  if (!error) return null;
  if (hasData) return <ErrorBanner message={error} onRetry={onRetry} className={className} />;
  const offline = /reach the server|connection/i.test(error);
  return (
    <div className="group">
      <div className="empty is-error" role="alert">
        <Icon name={offline ? "wifiOff" : "alertCircle"} />
        <h3>{offline ? "You seem to be offline" : "Could not load this"}</h3>
        <p>{error}</p>
        {onRetry && (
          <button type="button" className="btn btn-sm" onClick={onRetry}>
            <Icon name="refresh" size={16} /> Retry
          </button>
        )}
      </div>
    </div>
  );
}

export function SectionTitle({ children, action }) {
  return (
    <div className="section-title">
      <span>{children}</span>
      {action}
    </div>
  );
}

/** "Refresh" for a section title: spins while it loads. */
export function RefreshButton({ onClick, loading }) {
  return (
    <button type="button" className="link-btn" onClick={onClick} disabled={loading}>
      <Icon name="refresh" size={16} />
      Refresh
    </button>
  );
}
