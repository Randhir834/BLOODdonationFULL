import { useRef, useState } from "react";
import { PhoneField } from "../../components/Fields";
import { Spinner } from "../../components/Feedback";
import { NavIcon } from "../../components/Icons";
import { COUNTRIES, ENABLED_COUNTRIES, toE164 } from "../../lib/phone";
import { authErrorMessage } from "./authService";
import { useSessionWait } from "./useSessionWait";

/**
 * Asks for a mobile number. `onSubmit(e164)` either moves the flow on (the next step replaces this one, or the
 * session arrives and the page changes) or throws, and the message is shown under the field.
 */
export default function PhoneStep({ onSubmit, sendsCode, label = "Mobile number", cta = "Continue" }) {
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
      <PhoneField
        label={label}
        value={national}
        onChange={(digits) => {
          setNational(digits);
          setError("");
        }}
        country={countryId}
        onCountry={(id) => {
          setCountryId(id);
          setNational("");
        }}
        error={error}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- the number is the only thing on this screen
        autoFocus
      />
      <button className="btn btn-primary btn-block" type="submit" disabled={disabled}>
        {disabled && <Spinner />}
        {disabled ? (sendsCode ? "Sending code" : "Signing in") : cta}
      </button>
      {sendsCode && (
        <p className="auth-note">
          <NavIcon name="shieldCheck" size={16} />
          <span>We will send an SMS to verify your number. Message and data rates may apply.</span>
        </p>
      )}
    </form>
  );
}
