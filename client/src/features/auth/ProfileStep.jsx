import { useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { Icon } from "../../components/Icon";
import Spinner from "../../components/Spinner";
import { ErrorBanner } from "../../components/States";
import { APPROVAL_ROLES } from "../../lib/approval";
import { BLOOD_GROUPS, ROLES } from "../../lib/constants";
import { authErrorMessage, logout, registerProfile } from "./authService";
import { setSession } from "./authSlice";

const ROLE_OPTIONS = [
  { value: ROLES.DONOR, label: "Donor", text: "I give blood", nameLabel: "Full name", icon: "drop" },
  {
    value: ROLES.HOSPITAL,
    label: "Hospital",
    text: "We request blood for patients",
    nameLabel: "Hospital name",
    icon: "hospital",
  },
  {
    value: ROLES.ORGANISATION,
    label: "Blood bank",
    text: "We collect, store and issue blood",
    nameLabel: "Blood bank name",
    icon: "building",
  },
];

/** First sign-in only: the number is verified, now choose a role and create the profile. */
export default function ProfileStep() {
  const dispatch = useDispatch();
  const [role, setRole] = useState(ROLES.DONOR);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [website, setWebsite] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  // A ref, not state: state updates land on the next render, so a second click landing before that
  // render commits would otherwise slip past a `busy` check and fire a second request.
  const submitting = useRef(false);

  const roleInfo = ROLE_OPTIONS.find((option) => option.value === role);
  const needsApproval = APPROVAL_ROLES.includes(role);

  const submit = async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    const next = {};
    if (!name.trim()) next.name = `Enter your ${roleInfo.nameLabel.toLowerCase()}.`;
    if (!address.trim()) next.address = "Enter your address.";
    if (!city.trim()) next.city = "Enter your city.";
    if (needsApproval && !registrationNumber.trim()) {
      next.registrationNumber = "Enter your registration or licence number.";
    }
    setErrors(next);
    setFormError("");
    if (Object.keys(next).length) return;

    submitting.current = true;
    setBusy(true);
    try {
      const user = await registerProfile({
        role,
        name,
        address,
        city,
        website: needsApproval ? website : "",
        registrationNumber: needsApproval ? registrationNumber : "",
        ...(role === ROLES.DONOR && bloodGroup && { bloodGroup }),
      });
      dispatch(setSession({ signedIn: true, user }));
    } catch (err) {
      console.error(err);
      setFormError(authErrorMessage(err));
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <h1>Set up your account</h1>
      <p className="lead">Choose how you will use Blood Bank.</p>

      <div className="form-section first">Account type</div>
      <div className="group choices" role="radiogroup" aria-label="Account type">
        {ROLE_OPTIONS.map((option) => (
          <button
            type="button"
            key={option.value}
            role="radio"
            aria-checked={role === option.value}
            className="choice"
            onClick={() => setRole(option.value)}
          >
            <Icon name={option.icon} />
            <span className="text">
              <b>{option.label}</b>
              <small>{option.text}</small>
            </span>
            <span className="radio" aria-hidden="true" />
          </button>
        ))}
      </div>

      <ErrorBanner message={formError} className="mb-16" />
      <div className="form-section">Your details</div>
      <div className="field">
        <label className="field-label" htmlFor="name">
          {roleInfo.nameLabel}
        </label>
        <input
          id="name"
          className={`input ${errors.name ? "invalid" : ""}`}
          value={name}
          maxLength={100}
          autoComplete="name"
          aria-invalid={!!errors.name}
          onChange={(event) => setName(event.target.value)}
        />
        {errors.name && <div className="field-error">{errors.name}</div>}
      </div>
      <div className="field">
        <label className="field-label" htmlFor="address">
          Address
        </label>
        <input
          id="address"
          className={`input ${errors.address ? "invalid" : ""}`}
          value={address}
          maxLength={200}
          autoComplete="street-address"
          aria-invalid={!!errors.address}
          onChange={(event) => setAddress(event.target.value)}
        />
        {errors.address && <div className="field-error">{errors.address}</div>}
      </div>
      <div className="field">
        <label className="field-label" htmlFor="city">
          City
        </label>
        <input
          id="city"
          className={`input ${errors.city ? "invalid" : ""}`}
          value={city}
          maxLength={100}
          autoComplete="address-level2"
          aria-invalid={!!errors.city}
          onChange={(event) => setCity(event.target.value)}
        />
        {errors.city ? (
          <div className="field-error">{errors.city}</div>
        ) : (
          <div className="field-hint">Blood requests near you are matched by city.</div>
        )}
      </div>
      {role === ROLES.DONOR && (
        <div className="field">
          <span className="field-label">
            Blood group <span className="muted">(optional)</span>
          </span>
          <div className="grid-groups" role="group" aria-label="Blood group">
            {BLOOD_GROUPS.map((group) => (
              <button
                type="button"
                key={group}
                className="gbtn"
                aria-pressed={bloodGroup === group}
                onClick={() => setBloodGroup(bloodGroup === group ? "" : group)}
              >
                {group}
              </button>
            ))}
          </div>
          <div className="field-hint">Lets us tell you about compatible blood requests near you.</div>
        </div>
      )}
      {needsApproval && (
        <>
          <div className="field">
            <label className="field-label" htmlFor="registrationNumber">
              Registration or licence number
            </label>
            <input
              id="registrationNumber"
              className={`input ${errors.registrationNumber ? "invalid" : ""}`}
              value={registrationNumber}
              maxLength={60}
              autoComplete="off"
              aria-invalid={!!errors.registrationNumber}
              aria-describedby="registrationNumber-hint"
              onChange={(event) => setRegistrationNumber(event.target.value)}
            />
            {errors.registrationNumber ? (
              <div className="field-error">{errors.registrationNumber}</div>
            ) : (
              <div className="field-hint" id="registrationNumber-hint">
                It&apos;s verified before you can start, and is not shown to anyone else.
              </div>
            )}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="website">
              Website <span className="muted">(optional)</span>
            </label>
            <input
              id="website"
              className="input"
              type="url"
              inputMode="url"
              value={website}
              maxLength={200}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </div>
        </>
      )}
      <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
        {busy && <Spinner />}
        {busy ? "Saving" : "Continue"}
      </button>
      <div className="auth-links auth-links-center">
        <button type="button" className="link-btn" onClick={logout}>
          Use a different number
        </button>
      </div>
    </form>
  );
}
