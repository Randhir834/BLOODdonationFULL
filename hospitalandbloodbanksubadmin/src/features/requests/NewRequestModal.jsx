import { useRef, useState } from "react";
import { AmountField, GroupPicker, SelectField, TextArea, TextField } from "../../components/Fields";
import { Notice, Spinner } from "../../components/Feedback";
import Modal from "../../components/Modal";
import api, { errorMessage, fieldErrors } from "../../lib/api";
import { REQUEST_COMPONENT_LABEL, REQUEST_PRIORITY_LABEL } from "../../lib/constants";
import { notify } from "../../lib/notify";

// Whole blood is the default choice, offered as the empty option, so it is not listed twice.
const COMPONENTS = Object.entries(REQUEST_COMPONENT_LABEL)
  .filter(([value]) => value !== "whole_blood")
  .map(([value, label]) => ({ value, label }));

/**
 * Raises a blood request, shown to every other hospital and blood bank in the organisation's city (and to the
 * people using the mobile app there), or edits one that is still open. When editing, the blood group, component
 * and priority start at their saved values (they are always sent); every other field starts blank and only what
 * is typed is changed.
 */
export default function NewRequestModal({ request, onClose, onDone }) {
  const editing = Boolean(request);
  const [group, setGroup] = useState(request?.bloodGroup || "");
  const [component, setComponent] = useState(
    request?.component !== "whole_blood" ? request?.component || "" : ""
  );
  const [priority, setPriority] = useState(request?.priority || "normal");
  const [patientName, setPatientName] = useState("");
  const [amount, setAmount] = useState("");
  const [requiredAt, setRequiredAt] = useState("");
  const [location, setLocation] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
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
    if (!group) next.bloodGroup = "Choose a blood group.";
    if (!editing && !patientName.trim()) next.patientName = "Enter the patient's name.";
    if (!editing && !location.trim()) next.location = "Enter the hospital or location.";
    if (amount ? !Number.isInteger(quantity) || quantity <= 0 : !editing)
      next.quantity = "Enter the amount in ML, as a whole number.";
    setErrors(next);
    setFormError("");
    if (Object.keys(next).length) return;

    const body = editing
      ? {
          bloodGroup: group,
          component: component || "whole_blood",
          priority,
          ...(patientName.trim() && { patientName: patientName.trim() }),
          ...(amount && { quantity }),
          ...(requiredAt && { requiredAt }),
          ...(location.trim() && { location: location.trim() }),
          ...(contactName.trim() && { contactName: contactName.trim() }),
          ...(contactPhone.trim() && { contactPhone: contactPhone.trim() }),
          ...(note.trim() && { note: note.trim() }),
        }
      : {
          patientName: patientName.trim(),
          bloodGroup: group,
          component: component || "whole_blood",
          quantity,
          priority,
          ...(requiredAt && { requiredAt }),
          location: location.trim(),
          contactName: contactName.trim(),
          contactPhone: contactPhone.trim(),
          note: note.trim(),
        };

    submitting.current = true;
    setBusy(true);
    try {
      if (editing) await api.patch(`/requests/${request._id}`, body);
      else await api.post("/requests", body);
      notify.success(editing ? "Request updated" : "Request sent to your city");
      onDone();
    } catch (error) {
      const fromServer = fieldErrors(error);
      if (Object.keys(fromServer).length) setErrors((current) => ({ ...current, ...fromServer }));
      setFormError(errorMessage(error, "Could not send the request. Please try again."));
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal
      wide
      title={editing ? "Edit request" : "Request blood"}
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="request-form" className="btn btn-primary" disabled={busy}>
            {busy && <Spinner />}
            {editing ? "Save changes" : "Send request"}
          </button>
        </>
      }
    >
      <form id="request-form" onSubmit={submit} noValidate>
        {!editing && (
          <p>
            Every hospital and blood bank in your city, and the people using the mobile app there, can see and
            answer it.
          </p>
        )}
        {editing && <p>Leave a field blank to keep what is saved. Only what you type is changed.</p>}
        {formError && (
          <Notice className="form-note" role="alert">
            {formError}
          </Notice>
        )}

        <div className="form-section">Patient</div>
        <div className="form-grid">
          <TextField
            label="Patient's name"
            value={patientName}
            onChange={(value) => {
              setPatientName(value);
              clear("patientName");
            }}
            error={errors.patientName}
            optional={editing}
          />
          <TextField
            label="Hospital or location"
            value={location}
            onChange={(value) => {
              setLocation(value);
              clear("location");
            }}
            error={errors.location}
            optional={editing}
            hint="Where the blood is needed."
          />
        </div>

        <div className="form-section">What is needed</div>
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
          optional={editing}
        />
        <div className="form-grid">
          <SelectField
            label="Blood component"
            value={component}
            onChange={setComponent}
            options={COMPONENTS}
            choose="Whole blood"
          />
          <TextField
            label="Needed by"
            type="datetime-local"
            value={requiredAt}
            onChange={setRequiredAt}
            optional
          />
        </div>
        <div className="field-group">
          <span className="field-label" id="priority-label">
            Priority
          </span>
          <div className="seg" role="group" aria-labelledby="priority-label">
            {Object.entries(REQUEST_PRIORITY_LABEL).map(([value, label]) => (
              <button
                type="button"
                key={value}
                aria-pressed={priority === value}
                onClick={() => setPriority(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-section">Contact</div>
        <div className="form-grid">
          <TextField label="Contact name" value={contactName} onChange={setContactName} optional />
          <TextField
            label="Contact phone"
            type="tel"
            value={contactPhone}
            onChange={setContactPhone}
            optional
          />
          <TextArea className="span-2" label="Note" value={note} onChange={setNote} optional rows={3} />
        </div>
      </form>
    </Modal>
  );
}
