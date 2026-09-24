import { Icon } from "./Icon";

/** The title row of a bottom sheet, with its close button. `id` is what the sheet's `labelledBy` points at. */
export function SheetHeader({ id, title, subtitle, onClose }) {
  return (
    <div className="sheet-head">
      <div>
        <h2 id={id}>{title}</h2>
        {subtitle && <p className="sub">{subtitle}</p>}
      </div>
      <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
        <Icon name="close" />
      </button>
    </div>
  );
}

/** The scrolling middle of a sheet: long forms scroll here while the title and the buttons stay put. */
export function SheetBody({ children }) {
  return <div className="sheet-body">{children}</div>;
}

/** The buttons of a sheet, pinned to its bottom edge. */
export function SheetFooter({ children }) {
  return <div className="sheet-foot">{children}</div>;
}
