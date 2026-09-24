import { NavIcon } from "./Icons";
import { Icon } from "./Status";

/** A calm "nothing here" state: one small icon and one line of text, used everywhere a list is empty. */
export function Empty({ icon = "inbox", children }) {
  return (
    <div className="empty-state">
      <NavIcon name={icon} size={22} />
      <p>{children}</p>
    </div>
  );
}

export function ErrorNote({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="note note-error" role="alert">
      <div className="note-body">
        <Icon name="critical" size={16} />
        <span>{message}</span>
      </div>
      {onRetry && (
        <button type="button" className="btn btn-small" onClick={onRetry}>
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
