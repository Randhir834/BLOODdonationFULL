import { useRef, useState } from "react";
import { Notice, Spinner } from "../../components/Feedback";
import Modal from "../../components/Modal";
import api, { errorMessage, fieldErrors } from "../../lib/api";
import { notify } from "../../lib/notify";
import OrgFields from "./OrgFields";
import { emptyProfile, profileBody, validateProfile } from "./orgForm";

/**
 * Edits the organisation's details. Every field starts blank: a field left blank keeps what is saved, and only
 * what is typed is sent. The registration number is not offered once the account is approved.
 */
export default function EditProfileModal({ user, onClose, onSaved }) {
  const [values, setValues] = useState(emptyProfile);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const approved = user.verification === "approved";

  const setValue = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    const next = validateProfile(values, { editing: true, needsRegistration: !approved });
    setErrors(next);
    setFormError("");
    if (Object.keys(next).length) return;

    const body = profileBody(values, { editing: true });
    if (approved) delete body.registrationNumber;
    if (Object.keys(body).length === 0)
      return setFormError("Type in a field to change it, or close this window.");

    submitting.current = true;
    setBusy(true);
    try {
      await api.patch("/profile", body);
      notify.success("Details updated");
      await onSaved();
      onClose();
    } catch (error) {
      const fromServer = fieldErrors(error);
      if (Object.keys(fromServer).length) setErrors(fromServer);
      setFormError(errorMessage(error, "Could not save. Please try again."));
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal
      wide
      title="Edit details"
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="edit-profile" className="btn btn-primary" disabled={busy}>
            {busy && <Spinner />}
            Save changes
          </button>
        </>
      }
    >
      <form id="edit-profile" onSubmit={submit} noValidate>
        <p>Leave a field blank to keep what is saved. Only what you type is changed.</p>
        {formError && (
          <Notice className="form-note" role="alert">
            {formError}
          </Notice>
        )}
        <OrgFields
          values={values}
          setValue={setValue}
          errors={errors}
          role={user.role}
          editing
          canEditRegistration={!approved}
        />
      </form>
    </Modal>
  );
}
