import { useRef, useState } from "react";
import { TextField } from "../../components/Fields";
import { Notice, Spinner } from "../../components/Feedback";
import Modal from "../../components/Modal";
import api, { errorMessage } from "../../lib/api";
import { notify } from "../../lib/notify";

/** A blood bank turns down a request that was sent straight to it. The reason is shown to the requester. */
export default function RejectModal({ request, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  const submit = async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    if (!reason.trim()) return setError("Give a reason, the requester will see it.");
    setError("");
    setFormError("");
    submitting.current = true;
    setBusy(true);
    try {
      await api.post(`/requests/${request._id}/reject`, { reason: reason.trim() });
      notify.success("Request rejected");
      onDone();
    } catch (err) {
      setFormError(errorMessage(err, "Could not reject the request."));
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Reject this request?"
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="reject-form" className="btn btn-danger" disabled={busy}>
            {busy && <Spinner />}
            Reject request
          </button>
        </>
      }
    >
      <form id="reject-form" onSubmit={submit} noValidate>
        <p>
          {request.quantity} ML of {request.bloodGroup} for {request.patientName}. This can not be undone.
        </p>
        {formError && (
          <Notice className="form-note" role="alert">
            {formError}
          </Notice>
        )}
        <TextField
          label="Reason"
          value={reason}
          onChange={(value) => {
            setReason(value);
            setError("");
          }}
          error={error}
        />
      </form>
    </Modal>
  );
}
