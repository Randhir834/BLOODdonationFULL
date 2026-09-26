import { useRef, useState } from "react";
import Modal from "../../components/Modal";
import { SheetBody, SheetFooter, SheetHeader } from "../../components/Sheet";
import Spinner from "../../components/Spinner";
import { ErrorBanner } from "../../components/States";
import { errorMessage } from "../../lib/api";
import { BLOOD_GROUPS, RECORD_TYPES } from "../../lib/constants";
import { fmtNum } from "../../lib/format";
import { notify } from "../../lib/notify";
import { DEFAULT_COUNTRY_CODE, toE164 } from "../../lib/phone";
import { createRecord } from "./inventoryApi";

const QUICK_AMOUNTS = [250, 350, 450, 500];

/** Blood banks: record blood coming in from a donor, or going out to a hospital. */
export default function AddBloodSheet({ initialType = RECORD_TYPES.IN, onClose, onDone }) {
  const [type, setType] = useState(initialType);
  const [group, setGroup] = useState("");
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  // A ref, not just `busy` state: state updates land on the next render, so a second click landing
  // before that render commits could otherwise slip past a `busy` check. This one matters more than most
  // — a duplicate submit here double-records a whole unit of blood added or issued, not just a UI hiccup.
  const submitting = useRef(false);

  const adding = type === RECORD_TYPES.IN;

  // An error disappears as soon as the field it is about is edited.
  const clear = (field) => setErrors((current) => ({ ...current, [field]: undefined }));

  const submit = async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    const quantity = Number(amount);
    const e164 = toE164(phone);
    const next = {};
    if (!group) next.group = "Choose a blood group.";
    if (!Number.isInteger(quantity) || quantity <= 0)
      next.amount = "Enter the amount in ML, as a whole number.";
    if (!e164) next.phone = "Enter a valid mobile number.";
    setErrors(next);
    setServerError("");
    if (Object.keys(next).length) return;

    submitting.current = true;
    setBusy(true);
    try {
      await createRecord({ phone: e164, inventoryType: type, bloodGroup: group, quantity });
      notify.success(`${fmtNum(quantity)} ML of ${group} ${adding ? "added" : "issued"}`);
      onDone();
    } catch (error) {
      setServerError(errorMessage(error, "Could not save the record. Please try again."));
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal as="form" labelledBy="sheet-title" onClose={onClose} onSubmit={submit} noValidate>
      <SheetHeader id="sheet-title" title={adding ? "Add blood" : "Issue blood"} onClose={onClose} />
      <SheetBody>
        <div className="seg mb-20" role="group" aria-label="Record type">
          <button type="button" aria-pressed={adding} onClick={() => setType(RECORD_TYPES.IN)}>
            Add from donor
          </button>
          <button type="button" aria-pressed={!adding} onClick={() => setType(RECORD_TYPES.OUT)}>
            Issue to hospital
          </button>
        </div>

        <ErrorBanner message={serverError} className="mb-16" />

        <div className="field">
          <span className="field-label">Blood group</span>
          <div className="grid-groups" role="group" aria-label="Blood group">
            {BLOOD_GROUPS.map((name) => (
              <button
                type="button"
                key={name}
                className="gbtn"
                aria-pressed={group === name}
                onClick={() => {
                  setGroup(name);
                  clear("group");
                }}
              >
                {name}
              </button>
            ))}
          </div>
          {errors.group && <div className="field-error">{errors.group}</div>}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="amount">
            Amount
          </label>
          <div className="input-suffix">
            <input
              id="amount"
              className={`input num ${errors.amount ? "invalid" : ""}`}
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              value={amount}
              aria-invalid={!!errors.amount}
              onChange={(event) => {
                setAmount(event.target.value);
                clear("amount");
              }}
            />
            <span>ML</span>
          </div>
          <div className="amounts">
            {QUICK_AMOUNTS.map((quick) => (
              <button
                type="button"
                key={quick}
                aria-pressed={Number(amount) === quick}
                onClick={() => {
                  setAmount(String(quick));
                  clear("amount");
                }}
              >
                {quick}
              </button>
            ))}
          </div>
          {errors.amount && <div className="field-error">{errors.amount}</div>}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="person-phone">
            {adding ? "Donor" : "Hospital"}&apos;s mobile number
          </label>
          <div className={`phone ${errors.phone ? "invalid" : ""}`}>
            {!phone.trim().startsWith("+") && <span className="cc">{DEFAULT_COUNTRY_CODE}</span>}
            <input
              id="person-phone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={phone}
              aria-invalid={!!errors.phone}
              onChange={(event) => {
                setPhone(event.target.value);
                clear("phone");
              }}
            />
          </div>
          {errors.phone ? (
            <div className="field-error">{errors.phone}</div>
          ) : (
            <div className="field-hint">The number they signed up with.</div>
          )}
        </div>
      </SheetBody>
      <SheetFooter>
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy && <Spinner />}
          {busy ? "Saving" : adding ? "Add to stock" : "Issue blood"}
        </button>
      </SheetFooter>
    </Modal>
  );
}
