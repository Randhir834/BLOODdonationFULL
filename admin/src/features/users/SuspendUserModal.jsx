import { useState } from "react";
import { Spinner } from "../../components/Feedback";
import Modal from "../../components/Modal";
import { useToast } from "../../components/toastContext";
import api, { errorMessage } from "../../lib/api";
import { nameOf } from "../../lib/format";

/** Suspending needs a reason, it is kept in the activity log. The user is signed out right away. */
export default function SuspendUserModal({ user, onClose, onDone }) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      await api.post(`/users/${user._id}/suspend`, { reason });
      toast("User suspended");
      onDone();
    } catch (error) {
      toast(errorMessage(error), "error");
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Suspend ${nameOf(user)}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" onClick={run} disabled={busy || !reason.trim()}>
            {busy && <Spinner />}
            Suspend
          </button>
        </>
      }
    >
      <p>They will be signed out of the app right away and can not sign in until you reactivate them.</p>
      <label className="field">
        <span>Reason (kept in the activity log)</span>
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
