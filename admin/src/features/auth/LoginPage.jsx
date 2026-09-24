import { useState } from "react";
import { Notice, Spinner } from "../../components/Feedback";
import { BrandMark, NavIcon } from "../../components/Icons";
import { firebaseConfigured } from "../../lib/firebase";
import { useAuth } from "./authContext";

const MESSAGES = {
  "auth/invalid-credential": "Wrong email or password.",
  "auth/invalid-email": "Enter a valid email.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/too-many-requests": "Too many attempts. Please wait a few minutes and try again.",
  "auth/network-request-failed": "Network error. Please check your connection.",
  "auth/operation-not-allowed": "Email sign-in is not enabled in Firebase yet.",
};

export default function LoginPage() {
  const { login, notice } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const next = {};
    if (!email.trim()) next.email = "Enter your email.";
    if (!password) next.password = "Enter your password.";
    setErrors(next);
    setError("");
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      await login(email.trim(), password);
      // On success the auth provider checks the account with the server and shows the dashboard.
    } catch (err) {
      setError(MESSAGES[err.code] || "Could not sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit} noValidate>
        <div className="login-brand">
          <BrandMark size={52} />
        </div>
        <h1>Blood Bank Admin</h1>
        <p className="lead">Sign in with your admin account.</p>

        {!firebaseConfigured && (
          <Notice className="form-note">
            Firebase is not configured. Fill in admin/.env (see admin/.env.example).
          </Notice>
        )}
        {(error || notice) && (
          <Notice className="form-note" tone={error ? "error" : "warning"} role="alert">
            {error || notice}
          </Notice>
        )}

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            aria-invalid={!!errors.email}
            onChange={(event) => {
              setEmail(event.target.value);
              setErrors((current) => ({ ...current, email: undefined }));
            }}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- the email is the only thing on this screen
            autoFocus
          />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </label>
        <label className="field">
          <span>Password</span>
          <span className="password">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              aria-invalid={!!errors.password}
              onChange={(event) => {
                setPassword(event.target.value);
                setErrors((current) => ({ ...current, password: undefined }));
              }}
            />
            <button
              type="button"
              className="icon-btn"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((shown) => !shown)}
            >
              <NavIcon name={showPassword ? "eyeOff" : "eye"} size={18} />
            </button>
          </span>
          {errors.password && <span className="field-error">{errors.password}</span>}
        </label>
        <button className="btn btn-primary btn-block" type="submit" disabled={busy || !firebaseConfigured}>
          {busy && <Spinner />}
          {busy ? "Signing in" : "Sign in"}
        </button>
        <p className="login-foot">Only people added as admins can sign in here.</p>
      </form>
    </div>
  );
}
