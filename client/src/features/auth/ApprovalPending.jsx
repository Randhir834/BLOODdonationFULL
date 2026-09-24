import { useState } from "react";
import { useDispatch } from "react-redux";
import AuthShell from "../../components/AuthShell";
import { Icon } from "../../components/Icon";
import Spinner from "../../components/Spinner";
import { ErrorBanner, Notice } from "../../components/States";
import { VERIFICATION } from "../../lib/approval";
import { ROLE_LABEL } from "../../lib/constants";
import { formatPhone, nameOf } from "../../lib/format";
import { authErrorMessage, logout, refreshProfile } from "./authService";

/**
 * Shown instead of the app to a hospital or blood bank whose registration has not been approved yet
 * (or has been rejected). "Check again" reloads the profile, and the app opens by itself once it is approved.
 */
export default function ApprovalPending({ user }) {
  const dispatch = useDispatch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checked, setChecked] = useState(false);

  const rejected = user.verification === VERIFICATION.REJECTED;

  const check = async () => {
    setBusy(true);
    setError("");
    try {
      await refreshProfile(dispatch);
      // Approved: this screen is replaced by the app. Otherwise say that nothing has changed yet.
      setChecked(true);
    } catch (err) {
      console.error(err);
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const details = [
    ["Registered as", ROLE_LABEL[user.role]],
    ["Name", nameOf(user)],
    ["Registration number", user.registrationNumber],
    ["Mobile number", formatPhone(user.phone)],
  ].filter(([, value]) => value);

  // Where the registration stands: the first step is always done, the last is what everyone is waiting for.
  const steps = [
    { label: "Registration sent", state: "done" },
    { label: rejected ? "Review finished" : "Under review", state: rejected ? "done" : "current" },
    { label: "Ready to use", state: "todo" },
  ];

  return (
    <AuthShell>
      <h1>{rejected ? "Registration not approved" : "Waiting for approval"}</h1>
      <p className="lead">
        {rejected
          ? "This registration could not be approved. If you think this is a mistake, please contact our support team."
          : "Every hospital and blood bank is verified before it can record or receive blood. Check again in a little while."}
      </p>

      {!rejected && (
        <ol className="steps" aria-label="Approval progress">
          {steps.map((step) => (
            <li
              key={step.label}
              className={`step step-${step.state}`}
              aria-current={step.state === "current" ? "step" : undefined}
            >
              <span className="step-mark" aria-hidden="true">
                {step.state === "done" ? (
                  <Icon name="check" size={16} />
                ) : step.state === "current" ? (
                  <Icon name="clock" size={16} />
                ) : null}
              </span>
              <span className="step-label">{step.label}</span>
            </li>
          ))}
        </ol>
      )}

      {rejected && user.verificationReason && (
        <Notice tone="error" role="status" className="mb-16">
          Reason: {user.verificationReason}
        </Notice>
      )}
      <ErrorBanner message={error} onRetry={check} className="mb-16" />

      <div className="group mb-16">
        {details.map(([label, value]) => (
          <div className="kv kv-plain" key={label}>
            <div className="k">{label}</div>
            <div className="v">{value}</div>
          </div>
        ))}
      </div>

      {checked && !busy && !error && (
        <Notice tone="info" role="status" className="mb-16">
          Nothing has changed yet.
        </Notice>
      )}

      <button type="button" className="btn btn-primary btn-block" onClick={check} disabled={busy}>
        {busy && <Spinner />}
        {busy ? "Checking" : "Check again"}
      </button>
      <div className="auth-links auth-links-center">
        <button type="button" className="link-btn" onClick={logout}>
          Log out
        </button>
      </div>
    </AuthShell>
  );
}
