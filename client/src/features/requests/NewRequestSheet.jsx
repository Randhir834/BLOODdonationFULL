import { useState } from "react";
import Modal from "../../components/Modal";
import { SheetBody, SheetFooter, SheetHeader } from "../../components/Sheet";
import Spinner from "../../components/Spinner";
import { ErrorBanner } from "../../components/States";
import { errorMessage } from "../../lib/api";
import {
  BLOOD_GROUPS,
  REQUEST_COMPONENT_LABEL,
  REQUEST_COMPONENTS,
  REQUEST_PRIORITIES,
  REQUEST_PRIORITY_LABEL,
} from "../../lib/constants";
import { notify } from "../../lib/notify";
import { createRequest, updateRequest } from "./requestsApi";

const QUICK_AMOUNTS = [250, 350, 450, 500];

/**
 * Any signed-in donor, hospital or blood bank: raises a request, broadcast to their own city so any
 * relevant donor, hospital or blood bank there can see and respond to it. Also edits an existing
 * pending request. Blood group, component and priority (a fixed choice either way) start at the
 * request's current value when editing; every other field starts blank, and is left out of the update
 * unless the person actually types into it, so it keeps its current value.
 */
export default function NewRequestSheet({ request, onClose, onDone }) {
  const editing = !!request;
  const [group, setGroup] = useState(request?.bloodGroup || "");
  const [component, setComponent] = useState(request?.component || "whole_blood");
  const [priority, setPriority] = useState(request?.priority || "normal");
  const [patientName, setPatientName] = useState("");
  const [amount, setAmount] = useState("");
  const [requiredAt, setRequiredAt] = useState("");
  const [location, setLocation] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);

  const clear = (field) => setErrors((current) => ({ ...current, [field]: undefined }));

  const submit = async (event) => {
    event.preventDefault();
    const quantity = amount ? Number(amount) : undefined;
    const next = {};
    if (!group) next.group = "Choose a blood group.";
    if (!editing && !patientName.trim()) next.patientName = "Enter the patient's name.";
    if (!editing && !location.trim()) next.location = "Enter the hospital or location.";
    if (amount ? !Number.isInteger(quantity) || quantity <= 0 : !editing)
      next.amount = "Enter the amount in ML, as a whole number.";
    setErrors(next);
    setServerError("");
    if (Object.keys(next).length) return;

    const body = editing
      ? {
          bloodGroup: group,
          component,
          priority,
          ...(patientName.trim() && { patientName: patientName.trim() }),
          ...(amount && { quantity }),
          ...(requiredAt && { requiredAt }),
          ...(location.trim() && { location: location.trim() }),
          ...(contactName.trim() && { contactName: contactName.trim() }),
          ...(contactPhone.trim() && { contactPhone: contactPhone.trim() }),
          ...(note.trim() && { note }),
        }
      : {
          patientName: patientName.trim(),
          bloodGroup: group,
          component,
          quantity,
          priority,
          requiredAt: requiredAt || undefined,
          location: location.trim(),
          contactName: contactName.trim(),
          contactPhone: contactPhone.trim(),
          note,
        };

    setBusy(true);
    try {
      if (editing) await updateRequest(request._id, body);
      else await createRequest(body);
      notify.success(editing ? "Request updated" : "Request sent");
      onDone();
    } catch (error) {
      setServerError(errorMessage(error, "Could not send the request. Please try again."));
      setBusy(false);
    }
  };

  return (
    <Modal as="form" labelledBy="request-title" onClose={onClose} onSubmit={submit} noValidate>
      <SheetHeader
        id="request-title"
        title={editing ? "Edit request" : "Request blood"}
        subtitle={editing ? undefined : "Everyone nearby who can help will see this."}
        onClose={onClose}
      />
      <SheetBody>
        <ErrorBanner message={serverError} className="mb-16" />

        <div className="form-section">Patient</div>
        <div className="field">
          <label className="field-label" htmlFor="patient-name">
            Patient / recipient name
          </label>
          <input
            id="patient-name"
            className={`input ${errors.patientName ? "invalid" : ""}`}
            value={patientName}
            aria-invalid={!!errors.patientName}
            onChange={(event) => {
              setPatientName(event.target.value);
              clear("patientName");
            }}
          />
          {errors.patientName && <div className="field-error">{errors.patientName}</div>}
        </div>

        <div className="form-section">What is needed</div>
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
          <label className="field-label" htmlFor="component">
            Component / type
          </label>
          <select
            id="component"
            className="input"
            value={component}
            onChange={(event) => setComponent(event.target.value)}
          >
            {REQUEST_COMPONENTS.map((value) => (
              <option key={value} value={value}>
                {REQUEST_COMPONENT_LABEL[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="amount">
            Units required
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
          <span className="field-label">Urgency</span>
          <div className="seg" role="group" aria-label="Urgency">
            {REQUEST_PRIORITIES.map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={priority === value}
                onClick={() => setPriority(value)}
              >
                {REQUEST_PRIORITY_LABEL[value]}
              </button>
            ))}
          </div>
        </div>

        <div className="form-section">Where and when</div>
        <div className="field">
          <label className="field-label" htmlFor="location">
            Hospital / location
          </label>
          <input
            id="location"
            className={`input ${errors.location ? "invalid" : ""}`}
            value={location}
            aria-invalid={!!errors.location}
            onChange={(event) => {
              setLocation(event.target.value);
              clear("location");
            }}
          />
          {errors.location && <div className="field-error">{errors.location}</div>}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="required-at">
            Needed by <span className="muted">(optional)</span>
          </label>
          <input
            id="required-at"
            type="datetime-local"
            className="input"
            value={requiredAt}
            onChange={(event) => setRequiredAt(event.target.value)}
          />
        </div>

        <div className="form-section">Contact</div>
        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="contact-name">
              Contact name <span className="muted">(optional)</span>
            </label>
            <input
              id="contact-name"
              className="input"
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="contact-phone">
              Contact phone <span className="muted">(optional)</span>
            </label>
            <input
              id="contact-phone"
              className="input"
              type="tel"
              inputMode="tel"
              value={contactPhone}
              onChange={(event) => setContactPhone(event.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="request-note">
            Additional details <span className="muted">(optional)</span>
          </label>
          <textarea
            id="request-note"
            className="input"
            maxLength={300}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>

        {editing && <div className="field-hint">Leave a field blank to keep its current value.</div>}
      </SheetBody>
      <SheetFooter>
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy && <Spinner />}
          {busy ? "Sending" : editing ? "Save changes" : "Send request"}
        </button>
      </SheetFooter>
    </Modal>
  );
}
