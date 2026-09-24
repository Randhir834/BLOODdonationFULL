import { ICONS } from "./Icon";

const TYPE_ICON = {
  success: "checkCircle",
  error: "alertCircle",
  warning: "alertTriangle",
  info: "info",
};

/** The leading glyph of a toast, drawn from the app's own icon set. Passed to <ToastContainer icon>. */
export function ToastIcon({ type }) {
  const paths = ICONS[TYPE_ICON[type] || TYPE_ICON.info];
  return (
    <svg
      className={`toast-icon toast-icon-${TYPE_ICON[type] ? type : "info"}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** A short headline and, when it helps, one line saying what happened next. */
export function ToastBody({ title, description }) {
  return (
    <div>
      <div className="toast-title">{title}</div>
      {description && <div className="toast-text">{description}</div>}
    </div>
  );
}
