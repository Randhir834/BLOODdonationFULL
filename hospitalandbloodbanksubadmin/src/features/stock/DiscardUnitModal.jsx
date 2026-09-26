import { useRef, useState } from "react";
import { SelectField, TextField } from "../../components/Fields";
import { Notice, Spinner } from "../../components/Feedback";
import Modal from "../../components/Modal";
import api, { errorMessage } from "../../lib/api";
import { DISCARD_REASON_LABEL } from "../../lib/constants";
import { fmtMl } from "../../lib/format";
import { notify } from "../../lib/notify";

const REASONS = Object.entries(DISCARD_REASON_LABEL).map(([value, label]) => ({ value, label }));

/** Throws away a unit nothing has been issued from. The record and the reason stay in the history. */
export default function DiscardUnitModal({ unit, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  const submit = async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    if (!reason) return setError("Choose a reason.");
    setError("");
    setFormError("");

    submitting.current = true;
    setBusy(true);
    try {
      await api.post(`/stock/units/${unit._id}/discard`, { reason, note: note.trim() });
      notify.success(`Unit ${unit.unitId} discarded`);
      onDone();
    } catch (err) {
      setFormError(errorMessage(err, "Could not discard the unit. Please try again."));
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Discard this unit?"
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Keep it
          </button>
          <button type="submit" form="discard-unit" className="btn btn-danger" disabled={busy}>
            {busy && <Spinner />}
            Discard unit
          </button>
        </>
      }
    >
      <form id="discard-unit" onSubmit={submit} noValidate>
        <p>
          {unit.unitId}: {fmtMl(unit.quantity)} of {unit.bloodGroup} comes out of stock. It stays in the
          history with the reason.
        </p>
        {formError && (
          <Notice className="form-note" role="alert">
            {formError}
          </Notice>
        )}
        <SelectField label="Reason" value={reason} onChange={setReason} options={REASONS} error={error} />
        <TextField label="Note" value={note} onChange={setNote} optional />
      </form>
    </Modal>
  );
}
