import { useState } from "react";
import Modal from "../../components/Modal";
import { SheetBody, SheetFooter, SheetHeader } from "../../components/Sheet";
import Spinner from "../../components/Spinner";
import { ErrorBanner } from "../../components/States";
import { errorMessage } from "../../lib/api";
import { DISCARD_REASON_LABEL, DISCARD_REASONS } from "../../lib/constants";
import { notify } from "../../lib/notify";
import { discardUnit } from "./inventoryApi";

/** Blood bank: throws away a unit that was never issued (contaminated, damaged, expired, ...). */
export default function DiscardUnitSheet({ record, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!reason) {
      setReasonError("Choose a reason.");
      return;
    }
    setReasonError("");
    setServerError("");
    setBusy(true);
    try {
      await discardUnit(record._id, { reason, note });
      notify.success("Unit discarded");
      onDone();
    } catch (error) {
      setServerError(errorMessage(error, "Could not discard this unit. Please try again."));
      setBusy(false);
    }
  };

  return (
    <Modal as="form" labelledBy="discard-title" onClose={onClose} onSubmit={submit} noValidate>
      <SheetHeader
        id="discard-title"
        title={`Discard ${record.bloodGroup}, ${record.quantity} ML`}
        subtitle="This takes the unit out of your stock and can not be undone."
        onClose={onClose}
      />
      <SheetBody>
        <ErrorBanner message={serverError} className="mb-16" />

        <div className="field">
          <span className="field-label">Reason</span>
          <div className="grid-groups wide" role="radiogroup" aria-label="Reason">
            {DISCARD_REASONS.map((value) => (
              <button
                type="button"
                key={value}
                className="gbtn"
                role="radio"
                aria-checked={reason === value}
                onClick={() => {
                  setReason(value);
                  setReasonError("");
                }}
              >
                {DISCARD_REASON_LABEL[value]}
              </button>
            ))}
          </div>
          {reasonError && <div className="field-error">{reasonError}</div>}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="discard-note">
            Note <span className="muted">(optional)</span>
          </label>
          <textarea
            id="discard-note"
            className="input"
            maxLength={200}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
      </SheetBody>
      <SheetFooter>
        <button className="btn btn-danger btn-block" type="submit" disabled={busy}>
          {busy && <Spinner />}
          {busy ? "Discarding" : "Discard unit"}
        </button>
      </SheetFooter>
    </Modal>
  );
}
