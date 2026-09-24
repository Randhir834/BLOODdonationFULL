import { useState } from "react";
import { ErrorNote } from "../../components/Feedback";
import { BrandMark } from "../../components/Icons";
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
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
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
      <form className="card" onSubmit={submit}>
        <div className="login-brand">
          <BrandMark size={28} />
        </div>
        <h1>Blood Bank Admin</h1>
        <p className="hint">Sign in with your admin account.</p>

        {!firebaseConfigured && (
          <ErrorNote message="Firebase is not configured. Fill in admin/.env (see admin/.env.example)." />
        )}
        <ErrorNote message={error || notice} />

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- the email is the only thing on this screen
            autoFocus
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button className="btn btn-primary" type="submit" disabled={busy || !firebaseConfigured}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
