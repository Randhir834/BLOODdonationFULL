import { useState } from "react";
import Modal from "./Modal";

/**
 * An "are you sure" dialog. With `confirmText` the admin must type it first, for things that can not
 * be undone. `onConfirm` may be async, the button stays disabled until it finishes.
 */
export default function ConfirmModal({
  title,
  message,
  confirmLabel,
  danger,
  confirmText,
  onConfirm,
  onClose,
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const allowed = !confirmText || typed.trim().toLowerCase() === confirmText.toLowerCase();

  const run = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
            disabled={!allowed || busy}
            onClick={run}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p>{message}</p>
      {confirmText && (
        <label className="field">
          <span>
            Type <b>{confirmText}</b> to confirm
          </span>
          {/* eslint-disable-next-line jsx-a11y/no-autofocus -- the only thing to do in this dialog */}
          <input value={typed} onChange={(event) => setTyped(event.target.value)} autoFocus />
        </label>
      )}
    </Modal>
  );
}
