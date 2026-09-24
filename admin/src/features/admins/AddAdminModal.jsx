import { useState } from "react";
import { NavIcon } from "../../components/Icons";
import Modal from "../../components/Modal";
import { useToast } from "../../components/toastContext";
import api, { errorMessage } from "../../lib/api";

const MIN_PASSWORD = 12;

/** Creates another admin account. The password is shared with them privately by the admin. */
export default function AddAdminModal({ onClose, onAdded }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post("/admins", form);
      toast("Admin added");
      onAdded();
    } catch (error) {
      toast(errorMessage(error), "error");
      setBusy(false);
    }
  };

  return (
    <Modal title="Add an admin" onClose={onClose}>
      <form onSubmit={save}>
        <label className="field">
          <span>Name (optional)</span>
          <input value={form.name} onChange={set("name")} maxLength={100} />
        </label>
        <label className="field">
          <span>Email</span>
          <input type="email" required value={form.email} onChange={set("email")} autoComplete="off" />
        </label>
        <label className="field">
          <span>Password (at least {MIN_PASSWORD} characters)</span>
          <input
            type={show ? "text" : "password"}
            required
            minLength={MIN_PASSWORD}
            value={form.password}
            onChange={set("password")}
            autoComplete="new-password"
          />
        </label>
        <label className="hint">
          <input type="checkbox" checked={show} onChange={(event) => setShow(event.target.checked)} /> Show
          password
        </label>
        <p className="hint">
          Share the password with them privately. They sign in on this website with these details.
        </p>
        <div className="modal-foot modal-foot-inline">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            <NavIcon name="plus" size={16} />
            {busy ? "Adding…" : "Add admin"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
