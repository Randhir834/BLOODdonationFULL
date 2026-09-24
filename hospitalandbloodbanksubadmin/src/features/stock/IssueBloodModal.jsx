import { useRef, useState } from "react";
import { AmountField, GroupPicker, PhoneField, TextField } from "../../components/Fields";
import { Notice, Spinner } from "../../components/Feedback";
import Modal from "../../components/Modal";
import api, { errorMessage, fieldErrors } from "../../lib/api";
import { fmtMl, fmtNum } from "../../lib/format";
import { notify } from "../../lib/notify";
import { COUNTRIES, ENABLED_COUNTRIES, toE164 } from "../../lib/phone";

const COUNTRY = ENABLED_COUNTRIES[0];

/**
 * Blood going out, taken first-expiring-first. A blood bank issues to a hospital that has an account (found by
 * mobile number, so the hospital sees it and can confirm the delivery) or to anyone else, by name. A hospital
 * uses blood for a patient. `stock` is the per-group summary, used to say how much of a group there is.
 */
export default function IssueBloodModal({ role, stock, initialGroup = "", onClose, onDone }) {
  const bank = role === "organisation";
  const [group, setGroup] = useState(initialGroup);
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  // A ref, not just `busy` state: a duplicate submit here would double-issue real blood.
  const submitting = useRef(false);

  const clear = (field) => setErrors((current) => ({ ...current, [field]: undefined }));
  const available = group
    ? (stock?.groups.find((entry) => entry.bloodGroup === group)?.available ?? 0)
    : null;

  const submit = async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    const quantity = Number(amount);
    const next = {};
    if (!group) next.bloodGroup = "Choose a blood group.";
    if (!Number.isInteger(quantity) || quantity <= 0)
      next.quantity = "Enter the amount in ML, as a whole number.";
    else if (available !== null && quantity > available)
      next.quantity = `Only ${fmtMl(available)} of ${group} is in stock.`;
    if (phone && phone.length !== COUNTRIES[COUNTRY].digits)
      next.recipientPhone = `Enter a ${COUNTRIES[COUNTRY].digits}-digit number.`;
    if (bank ? !phone && !name.trim() : !name.trim()) {
      next.recipientName = bank
        ? "Enter the hospital's mobile number or a name."
        : "Enter the patient's name.";
    }
    setErrors(next);
    setFormError("");
    if (Object.keys(next).length) return;

    submitting.current = true;
    setBusy(true);
    try {
      await api.post("/stock/issue", {
        bloodGroup: group,
        quantity,
        ...(bank && phone && { recipientPhone: toE164(phone, COUNTRIES[COUNTRY].code) }),
        recipientName: name.trim(),
        reference: reference.trim(),
        note: note.trim(),
      });
      notify.success(`${fmtNum(quantity)} ML of ${group} issued`);
      onDone();
    } catch (error) {
      const fromServer = fieldErrors(error);
      if (Object.keys(fromServer).length) setErrors((current) => ({ ...current, ...fromServer }));
      setFormError(errorMessage(error, "Could not issue the blood. Please try again."));
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal
      wide
      title={bank ? "Issue blood" : "Use blood for a patient"}
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="issue-blood" className="btn btn-primary" disabled={busy}>
            {busy && <Spinner />}
            {bank ? "Issue blood" : "Record use"}
          </button>
        </>
      }
    >
      <form id="issue-blood" onSubmit={submit} noValidate>
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
            clear("quantity");
          }}
          error={errors.bloodGroup}
        />
        {group && (
          <p className="hint" role="status">
            {fmtMl(available)} of {group} in stock. The unit closest to expiry is used first.
          </p>
        )}
        <AmountField
          value={amount}
          onChange={(value) => {
            setAmount(value);
            clear("quantity");
          }}
          error={errors.quantity}
        />

        <div className="form-section">{bank ? "Issued to" : "Patient"}</div>
        <div className="form-grid">
          {bank && (
            <PhoneField
              label="Hospital's mobile number"
              value={phone}
              onChange={(value) => {
                setPhone(value);
                clear("recipientPhone");
                clear("recipientName");
              }}
              country={COUNTRY}
              error={errors.recipientPhone}
              optional
              hint="A hospital with an account sees the blood in its app and can confirm it arrived."
            />
          )}
          <TextField
            label={bank ? "Name" : "Patient's name"}
            value={name}
            onChange={(value) => {
              setName(value);
              clear("recipientName");
            }}
            error={errors.recipientName}
            optional={bank}
            hint={bank ? "For a patient or an organisation with no account." : undefined}
          />
          <TextField
            label={bank ? "Reference" : "Ward or case number"}
            value={reference}
            onChange={setReference}
            optional
          />
          <TextField label="Note" value={note} onChange={setNote} optional />
        </div>
      </form>
    </Modal>
  );
}
