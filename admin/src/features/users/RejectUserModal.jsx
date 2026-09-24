import { useState } from "react";
import Modal from "../../components/Modal";
import { useToast } from "../../components/toastContext";
import api, { errorMessage } from "../../lib/api";
import { nameOf } from "../../lib/format";

/** Rejecting needs a reason. The person sees it in the app, and it is kept in the activity log. */
export default function RejectUserModal({ user, onClose, onDone }) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      await api.post(`/users/${user._id}/reject`, { reason });
      toast("Registration rejected");
      onDone();
    } catch (error) {
      toast(errorMessage(error), "error");
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Reject ${nameOf(user)}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" onClick={run} disabled={busy || !reason.trim()}>
            Reject
          </button>
        </>
      }
    >
      <p>
        They will not be able to record or receive blood. They can still sign in to see this reason, and you
        can approve them later.
      </p>
      <label className="field">
        <span>Reason (shown to them and kept in the activity log)</span>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={200}
          // eslint-disable-next-line jsx-a11y/no-autofocus -- the only thing to do in this dialog
          autoFocus
        />
      </label>
    </Modal>
  );
}
