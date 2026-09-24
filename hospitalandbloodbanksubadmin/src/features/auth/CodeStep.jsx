import { useEffect, useRef, useState } from "react";
import { Spinner } from "../../components/Feedback";
import { formatPhone } from "../../lib/format";
import { notify } from "../../lib/notify";
import { authErrorMessage, sendOtp, verifyOtp } from "./authService";
import OtpInput from "./OtpInput";
import { useSessionWait } from "./useSessionWait";

const OTP_LENGTH = 6; // Firebase phone sign-in always sends 6 digits
const RESEND_SECONDS = 30;

const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** Second step of SMS sign-in: the 6-digit code, checked as soon as the last digit is typed. */
export default function CodeStep({ phone, onChangeNumber }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [waiting, waitForSession] = useSessionWait();
  // Refs, not state: state updates land on the next render, so a second call (e.g. paste plus the SMS
  // auto-fill both completing the code) landing before that render commits could otherwise slip past a
  // `busy` check and fire a second verify or resend.
  const verifying = useRef(false);
  const resending = useRef(false);

  useEffect(() => {
    if (seconds <= 0) return undefined;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  const verify = async (digits) => {
    if (verifying.current || waiting) return;
    verifying.current = true;
    setError("");
    setBusy(true);
    try {
      await verifyOtp(digits);
      waitForSession();
    } catch (err) {
      console.error(err);
      setError(authErrorMessage(err));
      setCode("");
    } finally {
      verifying.current = false;
      setBusy(false);
    }
  };

  const onCode = (digits) => {
    setCode(digits);
    setError("");
    if (digits.length === OTP_LENGTH) verify(digits);
  };

  const resend = async () => {
    if (resending.current) return;
    resending.current = true;
    setBusy(true);
    try {
      await sendOtp(phone);
      setCode("");
      setError("");
      setSeconds(RESEND_SECONDS);
      notify.success("Code sent");
    } catch (err) {
      console.error(err);
      notify.error(authErrorMessage(err));
    } finally {
      resending.current = false;
      setBusy(false);
    }
  };

  const disabled = busy || waiting;
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (code.length === OTP_LENGTH) verify(code);
      }}
    >
      <p className="lead">
        We sent a {OTP_LENGTH}-digit code to <b>{formatPhone(phone)}</b>.{" "}
        <button type="button" className="link-btn" onClick={onChangeNumber}>
          Change
        </button>
      </p>

      <OtpInput value={code} onChange={onCode} length={OTP_LENGTH} invalid={!!error} disabled={disabled} />
      <div className="otp-message">
        {error && (
          <div className="field-error" role="alert">
            {error}
          </div>
        )}
      </div>

      <button
        className="btn btn-primary btn-block"
        type="submit"
        disabled={disabled || code.length !== OTP_LENGTH}
      >
        {disabled && <Spinner />}
        {disabled ? "Verifying" : "Verify"}
      </button>
      <div className="auth-links-center">
        {seconds > 0 ? (
          <span>Resend code in {clock(seconds)}</span>
        ) : (
          <span>
            Did not get it?{" "}
            <button type="button" className="link-btn" disabled={disabled} onClick={resend}>
              Resend code
            </button>
          </span>
        )}
      </div>
    </form>
  );
}
