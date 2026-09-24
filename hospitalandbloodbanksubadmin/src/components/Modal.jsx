import { useEffect, useRef } from "react";
import { NavIcon } from "./Icons";

// Open dialogs, the last one is on top. Escape only closes the top one.
const open = [];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A dialog over a dimmed backdrop (a bottom sheet on phones). Escape or a press outside closes it, Tab stays
 * inside it, the page behind does not scroll, and focus goes back to where it was. Render it only while open.
 */
export default function Modal({ title, onClose, children, footer, wide = false }) {
  const box = useRef(null);
  // The key handler below lives as long as the dialog, but must always call the latest onClose.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const me = {};
    const opener = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    open.push(me);

    const onKey = (event) => {
      if (open[open.length - 1] !== me) return;
      if (event.key === "Escape") return closeRef.current();
      if (event.key !== "Tab" || !box.current) return;
      const items = [...box.current.querySelectorAll(FOCUSABLE)];
      if (items.length === 0) return event.preventDefault();
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === box.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    box.current?.focus();

    return () => {
      window.removeEventListener("keydown", onKey);
      open.splice(open.indexOf(me), 1);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
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
