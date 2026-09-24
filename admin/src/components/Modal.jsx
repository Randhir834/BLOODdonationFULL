import { useEffect, useRef } from "react";
import { NavIcon } from "./Icons";

// Open dialogs, the last one is on top. Escape only closes the top one.
const open = [];

/** A dialog over a dimmed backdrop. Escape or a press outside closes it. Render it only while it is open. */
export default function Modal({ title, onClose, children, footer, wide = false }) {
  const box = useRef(null);
  // The key handler below lives as long as the dialog, but must always call the latest onClose.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const me = {};
    open.push(me);
    const onKey = (event) => event.key === "Escape" && open[open.length - 1] === me && closeRef.current();
    window.addEventListener("keydown", onKey);
    box.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      open.splice(open.indexOf(me), 1);
    };
  }, []);

  return (
    // Pressing the dimmed area closes the dialog as a pointer convenience; keyboard users have Escape.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div className="backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        className={`modal ${wide ? "modal-wide" : ""}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={box}
      >
        <header className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <NavIcon name="close" size={18} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}
