import { useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import Spinner from "../../components/Spinner";
import { COUNTRIES, ENABLED_COUNTRIES, toE164 } from "../../lib/phone";
import { authErrorMessage } from "./authService";
import { useSessionWait } from "./useSessionWait";

/**
 * Asks for a mobile number. `onSubmit(e164)` either moves the flow on (the next step replaces this one,
 * or the session arrives and the page changes) or throws, and the message is shown under the field.
 */
export default function PhoneStep({ onSubmit, sendsCode }) {
  const [countryId, setCountryId] = useState(ENABLED_COUNTRIES[0]);
  const [national, setNational] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [waiting, waitForSession] = useSessionWait();
  const country = COUNTRIES[countryId];
  // A ref, not state: state updates land on the next render, so a second click landing before that
  // render commits would otherwise slip past a `busy` check and fire a second request.
  const submitting = useRef(false);

  const submit = async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    const e164 = national.length === country.digits ? toE164(national, country.code) : null;
    if (!e164) return setError(`Enter a ${country.digits}-digit mobile number.`);

    submitting.current = true;
    setError("");
    setBusy(true);
    try {
      await onSubmit(e164);
      waitForSession();
    } catch (err) {
      console.error(err);
      setError(authErrorMessage(err));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const disabled = busy || waiting;
  return (
    <form onSubmit={submit} noValidate>
      <h1>Sign in</h1>
      <p className="lead">
        {sendsCode
          ? "Enter your mobile number and we will text you a verification code."
          : `Enter your ${country.digits}-digit mobile number to continue.`}
      </p>

      <div className="field">
        <label className="field-label" htmlFor="mobile">
          Mobile number
        </label>
        <div className={`phone ${error ? "invalid" : ""}`}>
          {ENABLED_COUNTRIES.length > 1 ? (
            <select
              className="cc"
              aria-label="Country"
              value={countryId}
              onChange={(event) => {
                setCountryId(event.target.value);
                setNational("");
              }}
            >
              {ENABLED_COUNTRIES.map((id) => (
                <option key={id} value={id}>
                  {id} {COUNTRIES[id].code}
                </option>
              ))}
            </select>
          ) : (
            <span className="cc">{country.code}</span>
          )}
          <input
            id="mobile"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            // eslint-disable-next-line jsx-a11y/no-autofocus -- the number is the only thing on this screen
            autoFocus
            maxLength={country.digits}
            value={national}
            aria-invalid={!!error}
            aria-describedby={error ? "mobile-error" : undefined}
            onChange={(event) => setNational(event.target.value.replace(/\D/g, ""))}
          />
        </div>
        {error && (
          <div id="mobile-error" className="field-error" role="alert">
            {error}
          </div>
        )}
      </div>

      <button className="btn btn-primary btn-block" type="submit" disabled={disabled}>
        {disabled && <Spinner />}
        {disabled ? (sendsCode ? "Sending code" : "Signing in") : "Continue"}
      </button>
      {sendsCode && (
        <p className="auth-note">
          <Icon name="shieldCheck" size={18} />
          <span>We will send an SMS to verify your number. Message and data rates may apply.</span>
        </p>
      )}
    </form>
  );
}
