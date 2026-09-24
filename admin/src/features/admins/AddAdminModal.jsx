import { useState } from "react";
import { Spinner } from "../../components/Feedback";
import { NavIcon } from "../../components/Icons";
import Modal from "../../components/Modal";
import { useToast } from "../../components/toastContext";
import api, { errorMessage } from "../../lib/api";

const MIN_PASSWORD = 12;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Creates another admin account. The password is shared with them privately by the admin. */
export default function AddAdminModal({ onClose, onAdded }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const save = async (event) => {
    event.preventDefault();
    const next = {};
    if (!EMAIL.test(form.email.trim())) next.email = "Enter a valid email address.";
    if (form.password.length < MIN_PASSWORD) next.password = `Use at least ${MIN_PASSWORD} characters.`;
    setErrors(next);
    setServerError("");
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      await api.post("/admins", { ...form, email: form.email.trim() });
      toast("Admin added");
      onAdded();
    } catch (error) {
      setServerError(errorMessage(error));
      setBusy(false);
    }
  };

  return (
    <Modal title="Add an admin" onClose={onClose}>
      <form onSubmit={save} noValidate>
        {serverError && (
          <div className="note note-error form-note" role="alert">
            <div className="note-body">
              <NavIcon name="alertCircle" size={18} />
              <span>{serverError}</span>
            </div>
          </div>
        )}
        <label className="field">
          <span>
            Name <span className="muted">(optional)</span>
          </span>
          <input value={form.name} onChange={set("name")} maxLength={100} />
        </label>
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={form.email}
            onChange={set("email")}
            autoComplete="off"
            aria-invalid={!!errors.email}
          />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </label>
        <label className="field">
          <span>Password (at least {MIN_PASSWORD} characters)</span>
          <span className="password">
            <input
              type={show ? "text" : "password"}
              value={form.password}
              onChange={set("password")}
              autoComplete="new-password"
              aria-invalid={!!errors.password}
            />
            <button
              type="button"
              className="icon-btn"
              aria-label={show ? "Hide password" : "Show password"}
              onClick={() => setShow((shown) => !shown)}
            >
              <NavIcon name={show ? "eyeOff" : "eye"} size={18} />
            </button>
          </span>
          {errors.password && <span className="field-error">{errors.password}</span>}
        </label>
        <p className="hint">
          Share the password with them privately. They sign in on this website with these details.
        </p>
        <div className="modal-foot modal-foot-inline">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? <Spinner /> : <NavIcon name="plus" size={16} />}
            {busy ? "Adding" : "Add admin"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
