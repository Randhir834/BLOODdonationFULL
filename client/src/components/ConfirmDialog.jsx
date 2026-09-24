import Modal from "./Modal";
import Spinner from "./Spinner";

/**
 * A yes/no question before something that is hard to undo. `tone="danger"` colours the confirm button red
 * for destructive actions; otherwise it is the app's primary button. Render it only while it is open.
 */
export default function ConfirmDialog({
  id = "confirm-title",
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "primary",
  busy = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal variant="dialog" role="alertdialog" labelledBy={id} onClose={busy ? () => {} : onCancel}>
      <h2 id={id}>{title}</h2>
      <p>{message}</p>
      <div className="dialog-actions">
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={`btn ${tone === "danger" ? "btn-danger" : "btn-primary"}`}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy && <Spinner />}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
