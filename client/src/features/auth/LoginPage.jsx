import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import AuthShell from "../../components/AuthShell";
import Splash from "../../components/Splash";
import { env } from "../../lib/env";
import CodeStep from "./CodeStep";
import PhoneStep from "./PhoneStep";
import ProfileStep from "./ProfileStep";
import { clearVerifier, sendOtp, signInDirect } from "./authService";

const sendsCode = env.authMode === "otp";

/** Phone number -> (SMS code) -> first time only: set up the account. */
function PhoneSignIn() {
  const [sentTo, setSentTo] = useState(null); // the number the code was sent to (E.164)

  // Leaving this screen (a successful sign-in navigates away) is the one place the reCAPTCHA widget is
  // otherwise never released: sendOtp only clears the previous one right before creating the next.
  useEffect(() => () => clearVerifier(), []);

  const submitPhone = async (e164) => {
    if (!sendsCode) return signInDirect(e164);
    await sendOtp(e164);
    setSentTo(e164);
    return undefined;
  };

  return (
    <>
      {sentTo ? (
        <CodeStep phone={sentTo} onChangeNumber={() => setSentTo(null)} />
      ) : (
        <PhoneStep onSubmit={submitPhone} sendsCode={sendsCode} />
      )}
      {/* Firebase attaches its invisible reCAPTCHA here before it sends an SMS. */}
      {sendsCode && <div id="recaptcha-container" />}
    </>
  );
}

export default function LoginPage() {
  const { loading, signedIn, user } = useSelector((state) => state.auth);

  if (loading) return <Splash />;
  // Already signed in with a profile (also right after a successful sign-in).
  if (user) return <Navigate to="/" replace />;

  return <AuthShell>{signedIn ? <ProfileStep /> : <PhoneSignIn />}</AuthShell>;
}
