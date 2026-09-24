import { NavIcon } from "./Icons";

/** A calm "nothing here" state: an icon, a line of explanation and, when there is one, the obvious next step. */
export function Empty({ icon = "inbox", title, children, action, quiet = false }) {
  return (
    <div className={`empty-state ${quiet ? "is-quiet" : ""}`.trim()}>
      <NavIcon name={icon} size={36} />
      {title && <h3>{title}</h3>}
      <p>{children}</p>
      {action}
    </div>
  );
}

const TONE_ICON = { error: "alertCircle", warning: "alertTriangle", info: "info", success: "checkCircle" };

/** A short message above a list or inside a form. `tone`: error (default), warning, info or success. */
export function Notice({ tone = "error", title, children, action, role, className = "" }) {
  return (
    <div
      className={`note note-${tone} ${className}`.trim()}
      role={role || (tone === "error" ? "alert" : "status")}
    >
      <div className="note-body">
        <NavIcon name={TONE_ICON[tone]} size={18} />
        <div>
          {title && <div className="note-title">{title}</div>}
          {children && <div className={title ? "note-text" : ""}>{children}</div>}
        </div>
      </div>
      {action && <div className="note-action">{action}</div>}
    </div>
  );
}

export function ErrorNote({ message, onRetry, className = "" }) {
  if (!message) return null;
  return (
    <Notice
      className={className}
      action={
        onRetry && (
          <button type="button" className="btn btn-small" onClick={onRetry}>
            Try again
          </button>
        )
      }
    >
      {message}
    </Notice>
  );
}

/**
 * A page's data could not be loaded. When older data is still on screen it is a banner above it; when there
 * is nothing to show at all it is a full "could not load" state, so a page never sits there empty.
 */
export function LoadError({ message, hasData, onRetry }) {
  if (!message) return null;
  if (hasData) return <ErrorNote message={message} onRetry={onRetry} className="form-note" />;
  const offline = /reach the server|connection/i.test(message);
  return (
    <div className="empty-state" role="alert">
      <NavIcon name={offline ? "wifiOff" : "alertCircle"} size={36} />
      <h3>{offline ? "Can not reach the server" : "Could not load this page"}</h3>
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn btn-small" onClick={onRetry}>
          <NavIcon name="refresh" size={16} />
          Try again
        </button>
      )}
    </div>
  );
}

/** Shown under a list that stopped at the server's read limit. */
export function TruncatedNote({ truncated }) {
  return truncated ? (
    <p className="hint">Showing the newest 2,000 matches. Narrow the filters to see older ones.</p>
  ) : null;
}

/** The title row every page starts with. */
export function PageHead({ title, children, actions }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {children && <p>{children}</p>}
      </div>
      {actions}
    </div>
  );
}

/** Spins inside a button while it works. */
export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

/** A full-page loading state, for the very first moment of a screen. */
export function PageLoading({ label = "Loading" }) {
  return (
    <div className="center" role="status">
      <Spinner />
      <span>{label}…</span>
    </div>
  );
}
