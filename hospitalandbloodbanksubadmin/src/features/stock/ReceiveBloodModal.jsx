import { useRef, useState } from "react";
import { AmountField, GroupPicker, PhoneField, TextField } from "../../components/Fields";
import { Notice, Spinner } from "../../components/Feedback";
import Modal from "../../components/Modal";
import api, { errorMessage, fieldErrors } from "../../lib/api";
import { fmtNum } from "../../lib/format";
import { notify } from "../../lib/notify";
import { ENABLED_COUNTRIES, COUNTRIES, toE164 } from "../../lib/phone";

const COUNTRY = ENABLED_COUNTRIES[0];

/**
 * Blood coming in, as one new unit. A blood bank records a donation, from a donor who has an account in the
 * app (found by mobile number, so it also appears in their donation history) or from anyone else, by name.
 * A hospital records blood it received from somewhere else (blood a blood bank issued through this website is
 * confirmed under "Deliveries" instead, which keeps its expiry date).
 */
export default function ReceiveBloodModal({ role, onClose, onDone }) {
  const bank = role === "organisation";
  const [group, setGroup] = useState("");
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [collectedAt, setCollectedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [bagNumber, setBagNumber] = useState("");
  const [storageLocation, setStorageLocation] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  // A ref, not just `busy` state: a duplicate submit here would double-record a whole unit of blood.
  const submitting = useRef(false);

  const clear = (field) => setErrors((current) => ({ ...current, [field]: undefined }));

  const submit = async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    const quantity = Number(amount);
    const next = {};
    if (!group) next.bloodGroup = "Choose a blood group.";
    if (!Number.isInteger(quantity) || quantity <= 0)
      next.quantity = "Enter the amount in ML, as a whole number.";
    if (phone && phone.length !== COUNTRIES[COUNTRY].digits)
      next.sourcePhone = `Enter a ${COUNTRIES[COUNTRY].digits}-digit number.`;
    if (bank ? !phone && !name.trim() : !name.trim()) {
      next.sourceName = bank ? "Enter the donor's mobile number or name." : "Enter who the blood came from.";
    }
    if (expiresAt && collectedAt && expiresAt <= collectedAt)
      next.expiresAt = "The expiry date must be after the collection date.";
    setErrors(next);
    setFormError("");
    if (Object.keys(next).length) return;

    submitting.current = true;
    setBusy(true);
    try {
      await api.post("/stock/receive", {
        bloodGroup: group,
        quantity,
        ...(bank && phone && { sourcePhone: toE164(phone, COUNTRIES[COUNTRY].code) }),
        sourceName: name.trim(),
        ...(collectedAt && { collectedAt }),
        ...(expiresAt && { expiresAt }),
        bagNumber: bagNumber.trim(),
        storageLocation: storageLocation.trim(),
        note: note.trim(),
      });
      notify.success(`${fmtNum(quantity)} ML of ${group} added to stock`);
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
      wide
      title={bank ? "Record a donation" : "Add blood to stock"}
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="receive-blood" className="btn btn-primary" disabled={busy}>
            {busy && <Spinner />}
            Add to stock
          </button>
        </>
      }
    >
      <form id="receive-blood" onSubmit={submit} noValidate>
        {formError && (
          <Notice className="form-note" role="alert">
            {formError}
          </Notice>
        )}
        <div className="form-section">Blood</div>
        <GroupPicker
          value={group}
          onChange={(value) => {
            setGroup(value);
            clear("bloodGroup");
          }}
          error={errors.bloodGroup}
        />
        <AmountField
          value={amount}
          onChange={(value) => {
            setAmount(value);
            clear("quantity");
          }}
          error={errors.quantity}
        />

        <div className="form-section">{bank ? "Donor" : "Received from"}</div>
        <div className="form-grid">
          {bank && (
            <PhoneField
              label="Donor's mobile number"
              value={phone}
              onChange={(value) => {
                setPhone(value);
                clear("sourcePhone");
                clear("sourceName");
              }}
              country={COUNTRY}
              error={errors.sourcePhone}
              optional
              hint="If the donor has an account in the app, the donation appears in their history."
            />
          )}
          <TextField
            label={bank ? "Donor's name" : "Blood bank or supplier"}
            value={name}
            onChange={(value) => {
              setName(value);
              clear("sourceName");
            }}
            error={errors.sourceName}
            optional={bank}
            hint={bank ? "Needed when the donor has no account in the app." : undefined}
          />
        </div>

        <div className="form-section">Storage</div>
        <div className="form-grid">
          <TextField
            label="Collected on"
            type="date"
            value={collectedAt}
            onChange={(value) => {
              setCollectedAt(value);
              clear("expiresAt");
            }}
            optional
            hint="Leave blank for today."
          />
          <TextField
            label="Expires on"
            type="date"
            value={expiresAt}
            onChange={(value) => {
              setExpiresAt(value);
              clear("expiresAt");
            }}
            error={errors.expiresAt}
            optional
            hint="Leave blank to use the standard shelf life."
          />
          <TextField label="Bag number" value={bagNumber} onChange={setBagNumber} optional />
          <TextField
            label="Storage location"
            value={storageLocation}
            onChange={setStorageLocation}
            optional
          />
          <TextField className="span-2" label="Note" value={note} onChange={setNote} optional />
        </div>
      </form>
    </Modal>
  );
}
