import { useState } from "react";
import Modal from "../../components/Modal";
import { useToast } from "../../components/toastContext";
import api, { errorMessage } from "../../lib/api";
import { BLOOD_GROUPS, NAME_LABEL, ROLE_LABEL } from "../../lib/constants";

/**
 * Edit a user's profile or move them to another role. The phone number is their sign-in, so it stays.
 * Text fields start empty, and one left blank keeps its existing value rather than being overwritten
 * with an empty one; role and blood group are fixed choices, so they start at the current value instead.
 */
export default function EditUserModal({ user, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    role: user.role,
    name: "",
    address: "",
    website: "",
    bloodGroup: user.bloodGroup || "",
  });
  const [busy, setBusy] = useState(false);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const save = async () => {
    setBusy(true);
    try {
      const payload = { role: form.role };
      if (form.name.trim()) payload.name = form.name.trim();
      if (form.address.trim()) payload.address = form.address.trim();
      if (form.website.trim()) payload.website = form.website.trim();
      if (form.role === "donar" && form.bloodGroup) payload.bloodGroup = form.bloodGroup;
      await api.patch(`/users/${user._id}`, payload);
      toast("User updated");
      onSaved();
    } catch (error) {
      toast(errorMessage(error), "error");
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Edit user"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
            Save changes
          </button>
        </>
      }
    >
      <label className="field">
        <span>Role</span>
        <select value={form.role} onChange={set("role")}>
          {Object.entries(ROLE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>{NAME_LABEL[form.role]}</span>
        <input value={form.name} onChange={set("name")} maxLength={100} />
      </label>
      <label className="field">
        <span>Address</span>
        <input value={form.address} onChange={set("address")} maxLength={200} />
      </label>
      <label className="field">
        <span>Website</span>
        <input value={form.website} onChange={set("website")} maxLength={200} />
      </label>
      {form.role === "donar" && (
        <label className="field">
          <span>Blood group</span>
          <select value={form.bloodGroup} onChange={set("bloodGroup")}>
            <option value="">Not set</option>
            {BLOOD_GROUPS.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="hint">Leave a field blank to keep its current value. The phone number can not be changed here: it is the user&apos;s sign-in.</p>
    </Modal>
  );
}
