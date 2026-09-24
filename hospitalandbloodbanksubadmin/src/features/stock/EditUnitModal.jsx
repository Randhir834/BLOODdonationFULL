import { useRef, useState } from "react";
import { AmountField, GroupPicker, TextField } from "../../components/Fields";
import { Notice, Spinner } from "../../components/Feedback";
import Modal from "../../components/Modal";
import api, { errorMessage, fieldErrors } from "../../lib/api";
import { fmtDate, fmtMl } from "../../lib/format";
import { notify } from "../../lib/notify";

/**
 * Corrects a unit still in stock. Every field starts blank: blank keeps what is saved and only what is typed is
 * sent. The amount and blood group can only be corrected while none of the unit has been issued.
 */
export default function EditUnitModal({ unit, onClose, onDone }) {
  const canCorrectBlood = !(unit.consumedQuantity > 0) && !unit.openingBalance;
  const [group, setGroup] = useState("");
  const [amount, setAmount] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [bagNumber, setBagNumber] = useState("");
  const [storageLocation, setStorageLocation] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  const clear = (field) => setErrors((current) => ({ ...current, [field]: undefined }));

  const submit = async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    const quantity = amount ? Number(amount) : undefined;
    const next = {};
    if (amount && (!Number.isInteger(quantity) || quantity <= 0))
      next.quantity = "Enter the amount in ML, as a whole number.";
    setErrors(next);
    setFormError("");
    if (Object.keys(next).length) return;

    const body = {
      ...(canCorrectBlood && group && { bloodGroup: group }),
      ...(canCorrectBlood && amount && { quantity }),
      ...(expiresAt && { expiresAt }),
      ...(bagNumber.trim() && { bagNumber: bagNumber.trim() }),
      ...(storageLocation.trim() && { storageLocation: storageLocation.trim() }),
      ...(note.trim() && { note: note.trim() }),
    };
    if (Object.keys(body).length === 0)
      return setFormError("Type in a field to change it, or close this window.");

    submitting.current = true;
    setBusy(true);
    try {
      await api.patch(`/stock/units/${unit._id}`, body);
      notify.success("Unit updated");
      onDone();
    } catch (error) {
      const fromServer = fieldErrors(error);
      if (Object.keys(fromServer).length) setErrors((current) => ({ ...current, ...fromServer }));
      setFormError(errorMessage(error, "Could not save. Please try again."));
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Correct unit ${unit.unitId}`}
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="edit-unit" className="btn btn-primary" disabled={busy}>
            {busy && <Spinner />}
            Save changes
          </button>
        </>
      }
    >
      <form id="edit-unit" onSubmit={submit} noValidate>
        <p>
          {unit.bloodGroup}, {fmtMl(unit.quantity)}, expires {fmtDate(unit.expiresAt)}
          {unit.storageLocation ? `, stored in ${unit.storageLocation}` : ""}. Leave a field blank to keep
          what is saved.
        </p>
        {formError && (
          <Notice className="form-note" role="alert">
            {formError}
          </Notice>
        )}
        {canCorrectBlood ? (
          <>
            <GroupPicker label="Correct the blood group" value={group} onChange={setGroup} />
            <AmountField
              label="Correct the amount (ML)"
              value={amount}
              onChange={(value) => {
                setAmount(value);
                clear("quantity");
              }}
              error={errors.quantity}
              optional
            />
          </>
        ) : (
          <Notice tone="info" className="form-note">
            {unit.openingBalance
              ? "This is an opening balance unit, so its amount and blood group are fixed."
              : "Blood has already been issued from this unit, so its amount and blood group are fixed."}
          </Notice>
        )}
        <TextField
          label="Expires on"
          type="date"
          value={expiresAt}
          onChange={setExpiresAt}
          error={errors.expiresAt}
          optional
        />
        <TextField label="Bag number" value={bagNumber} onChange={setBagNumber} optional />
        <TextField label="Storage location" value={storageLocation} onChange={setStorageLocation} optional />
        <TextField label="Note" value={note} onChange={setNote} optional />
      </form>
    </Modal>
  );
}
