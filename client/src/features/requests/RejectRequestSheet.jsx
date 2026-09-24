import { useState } from "react";
import Modal from "../../components/Modal";
import { SheetBody, SheetFooter, SheetHeader } from "../../components/Sheet";
import Spinner from "../../components/Spinner";
import { ErrorBanner } from "../../components/States";
import { errorMessage } from "../../lib/api";
import { notify } from "../../lib/notify";
import { rejectRequest } from "./requestsApi";

/** Blood bank: turns down a pending request. The requester sees the reason. */
export default function RejectRequestSheet({ request, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!reason.trim()) {
      setReasonError("Enter a reason.");
      return;
    }
    setReasonError("");
    setServerError("");
    setBusy(true);
    try {
      await rejectRequest(request._id, reason.trim());
      notify.success("Request rejected", "The requester can see your reason.");
      onDone();
    } catch (error) {
      setServerError(errorMessage(error, "Could not reject this request. Please try again."));
      setBusy(false);
    }
  };

  return (
    <Modal as="form" labelledBy="reject-title" onClose={onClose} onSubmit={submit} noValidate>
      <SheetHeader
        id="reject-title"
        title={`Reject ${request.quantity} ML ${request.bloodGroup}`}
        subtitle={`Requested for ${request.patientName}.`}
        onClose={onClose}
      />
      <SheetBody>
        <ErrorBanner message={serverError} className="mb-16" />

        <div className="field">
          <label className="field-label" htmlFor="reject-reason">
            Reason
          </label>
          <textarea
            id="reject-reason"
            className={`input ${reasonError ? "invalid" : ""}`}
            maxLength={200}
            value={reason}
            aria-invalid={!!reasonError}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- the only thing to do in this dialog
            autoFocus
            onChange={(event) => {
              setReason(event.target.value);
              setReasonError("");
            }}
          />
          {reasonError ? (
            <div className="field-error">{reasonError}</div>
          ) : (
            <div className="field-hint">The requester will see this.</div>
          )}
        </div>
      </SheetBody>
      <SheetFooter>
        <button className="btn btn-danger btn-block" type="submit" disabled={busy}>
          {busy && <Spinner />}
          {busy ? "Rejecting" : "Reject request"}
        </button>
      </SheetFooter>
    </Modal>
  );
}
