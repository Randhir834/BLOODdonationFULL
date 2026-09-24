import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A bottom sheet (variant "sheet") or a centred dialog (variant "dialog") over a dimmed overlay.
 * Esc or a tap outside closes it, Tab stays inside it, the page behind does not scroll, and focus
 * goes back to where it was when the modal closes. Render it only while it is open.
 * `as` lets the panel be a <form>.
 */
export default function Modal({
  as: Panel = "div",
  variant = "sheet",
  role = "dialog",
  labelledBy,
  onClose,
  children,
  ...panelProps
}) {
  const panel = useRef(null);
  // The key handler below lives as long as the modal, but must always call the latest onClose.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const opener = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") return onCloseRef.current();
      if (event.key !== "Tab") return;
      const items = [...panel.current.querySelectorAll(FOCUSABLE)];
      if (items.length === 0) return event.preventDefault();
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, []);

  return (
    // Pressing the dimmed area closes the modal as a pointer convenience; keyboard users have Escape.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className={`overlay ${variant === "dialog" ? "overlay-center" : ""}`.trim()}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <Panel
        ref={panel}
        className={variant}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        {...panelProps}
      >
        {children}
      </Panel>
    </div>
  );
}
