import { useRef, useState } from "react";
import { Notice, Spinner } from "../../components/Feedback";
import { BrandMark, NavIcon } from "../../components/Icons";
import { errorMessage, fieldErrors } from "../../lib/api";
import { formatPhone } from "../../lib/format";
import { auth } from "../../lib/firebase";
import OrgFields from "../profile/OrgFields";
import { emptyProfile, profileBody, validateProfile } from "../profile/orgForm";
import { useAuth } from "./authContext";

const CHOICES = [
  {
    value: "hospital",
    label: "Hospital",
    text: "We treat patients and need blood for them",
    icon: "hospital",
  },
  { value: "organisation", label: "Blood bank", text: "We collect, store and issue blood", icon: "building" },
];

/**
 * A verified number that has no account yet: what kind of organisation this is, and its details. It is created
 * as "waiting for approval", an admin checks the registration number before it can be used.
 */
export default function RegisterDetailsPage() {
  const { register, logout } = useAuth();
  const [role, setRole] = useState("");
  const [values, setValues] = useState(emptyProfile);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  // A ref, not state: a second click landing before the next render would otherwise slip past `busy`.
  const submitting = useRef(false);
  const phone = auth?.currentUser?.phoneNumber;

  const setValue = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    const next = validateProfile(values, { editing: false });
    if (!role) next.role = "Choose hospital or blood bank.";
    setErrors(next);
    setFormError("");
    if (Object.keys(next).length) return;

    submitting.current = true;
    setBusy(true);
    try {
      await register({ role, ...profileBody(values, { editing: false }) });
    } catch (error) {
      const fromServer = fieldErrors(error);
      if (Object.keys(fromServer).length) setErrors(fromServer);
      setFormError(errorMessage(error, "Could not register. Please try again."));
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <form className="login-card is-wide" onSubmit={submit} noValidate>
        <div className="login-brand">
          <BrandMark size={52} />
        </div>
        <h1>Tell us about your organisation</h1>
        <p className="lead">
          Your number is verified. Add your organisation&apos;s details and an admin will review the
          registration number before you can start.
        </p>
        {formError && (
          <Notice className="form-note" role="alert">
            {formError}
          </Notice>
        )}

        <div className="field-group">
          <span className="field-label" id="org-kind">
            This organisation is a
          </span>
          <div className="choices" role="group" aria-labelledby="org-kind">
            {CHOICES.map((choice) => (
              <button
                type="button"
                key={choice.value}
                className="choice"
                aria-pressed={role === choice.value}
                onClick={() => {
                  setRole(choice.value);
                  setErrors((current) => ({ ...current, role: undefined }));
                }}
              >
                <NavIcon name={choice.icon} size={24} />
                <span>
                  <b>{choice.label}</b>
                  <small>{choice.text}</small>
                </span>
              </button>
            ))}
          </div>
          {errors.role && (
            <div className="field-error" role="alert">
              {errors.role}
            </div>
          )}
        </div>

        {role && <OrgFields values={values} setValue={setValue} errors={errors} role={role} />}

        <button className="btn btn-primary btn-block" type="submit" disabled={busy || !role}>
          {busy && <Spinner />}
          {busy ? "Registering" : "Register"}
        </button>
        <p className="auth-switch">
          Not {phone ? formatPhone(phone) : "your number"}?{" "}
          <button type="button" className="link-btn" onClick={logout}>
            Sign out
          </button>
        </p>
      </form>
    </div>
  );
}
