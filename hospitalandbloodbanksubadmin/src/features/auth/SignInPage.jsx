import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Notice } from "../../components/Feedback";
import { BrandMark } from "../../components/Icons";
import { env, missingConfig } from "../../lib/env";
import { clearVerifier, sendOtp, signInDirect } from "./authService";
import CodeStep from "./CodeStep";
import PhoneStep from "./PhoneStep";
import { useAuth } from "./authContext";

const COPY = {
  login: {
    title: "Sign in",
    lead: "Sign in with the mobile number your hospital or blood bank is registered with.",
    label: "Mobile number",
  },
  register: {
    title: "Register your organisation",
    lead: "First, verify a mobile number. It becomes your sign-in, on this website and in the mobile app.",
    label: "Mobile number",
  },
};

/**
 * Phone number, then the SMS code. Signing in and registering start the same way: once the number is verified
 * the account is loaded, and a number that has not registered yet moves on to the organisation's details.
 */
export default function SignInPage({ mode = "login" }) {
  const { notice } = useAuth();
  const [phone, setPhone] = useState(null); // the number a code was sent to
  const sendsCode = env.authMode === "otp";
  const copy = COPY[mode];

  // The reCAPTCHA widget is released when leaving the screen.
  useEffect(() => clearVerifier, []);

  const submitPhone = async (e164) => {
    if (sendsCode) {
      await sendOtp(e164);
      setPhone(e164);
    } else {
      await signInDirect(e164);
    }
  };

  return (
    <div className="login">
      <div className="login-card">
        <div className="login-brand">
          <BrandMark size={52} />
        </div>
        <h1>{phone ? "Enter the code" : copy.title}</h1>
        {!phone && <p className="lead">{copy.lead}</p>}

        {missingConfig.length > 0 && (
          <Notice className="form-note">Firebase is not configured. Fill in .env (see .env.example).</Notice>
        )}
        {notice && (
          <Notice className="form-note" tone="warning">
            {notice}
          </Notice>
        )}

        {missingConfig.length === 0 &&
          (phone ? (
            <CodeStep phone={phone} onChangeNumber={() => setPhone(null)} />
          ) : (
            <PhoneStep onSubmit={submitPhone} sendsCode={sendsCode} label={copy.label} />
          ))}

        {!phone && (
          <p className="auth-switch">
            {mode === "login" ? (
              <>
                New here? <Link to="/register">Register your organisation</Link>
              </>
            ) : (
              <>
                Already registered? <Link to="/">Sign in</Link>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
