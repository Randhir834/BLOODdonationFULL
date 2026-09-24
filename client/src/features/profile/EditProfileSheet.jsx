import { useState } from "react";
import { useDispatch } from "react-redux";
import Modal from "../../components/Modal";
import { SheetBody, SheetFooter, SheetHeader } from "../../components/Sheet";
import Spinner from "../../components/Spinner";
import { ErrorBanner } from "../../components/States";
import { errorMessage } from "../../lib/api";
import { notify } from "../../lib/notify";
import { updateProfile } from "../auth/authService";

/** The signed-in user: corrects their own address and city. */
export default function EditProfileSheet({ user, onClose, onDone }) {
  const dispatch = useDispatch();
  const [address, setAddress] = useState(user.address || "");
  const [city, setCity] = useState(user.city || "");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);

  const clear = (field) => setErrors((current) => ({ ...current, [field]: undefined }));

  const submit = async (event) => {
    event.preventDefault();
    const next = {};
    if (!address.trim()) next.address = "Enter your address.";
    if (!city.trim()) next.city = "Enter your city.";
    setErrors(next);
    setServerError("");
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      await updateProfile(dispatch, { address: address.trim(), city: city.trim() });
      notify.success("Profile updated");
      onDone();
    } catch (error) {
      setServerError(errorMessage(error, "Could not update your profile. Please try again."));
      setBusy(false);
    }
  };

  return (
    <Modal as="form" labelledBy="edit-profile-title" onClose={onClose} onSubmit={submit} noValidate>
      <SheetHeader id="edit-profile-title" title="Edit profile" onClose={onClose} />
      <SheetBody>
        <ErrorBanner message={serverError} className="mb-16" />

        <div className="field">
          <label className="field-label" htmlFor="edit-address">
            Address
          </label>
          <input
            id="edit-address"
            className={`input ${errors.address ? "invalid" : ""}`}
            value={address}
            maxLength={200}
            autoComplete="street-address"
            aria-invalid={!!errors.address}
            onChange={(event) => {
              setAddress(event.target.value);
              clear("address");
            }}
          />
          {errors.address && <div className="field-error">{errors.address}</div>}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="edit-city">
            City
          </label>
          <input
            id="edit-city"
            className={`input ${errors.city ? "invalid" : ""}`}
            value={city}
            maxLength={100}
            autoComplete="address-level2"
            aria-invalid={!!errors.city}
            onChange={(event) => {
              setCity(event.target.value);
              clear("city");
            }}
          />
          {errors.city ? (
            <div className="field-error">{errors.city}</div>
          ) : (
            <div className="field-hint">Blood requests near you are matched by city.</div>
          )}
        </div>
      </SheetBody>
      <SheetFooter>
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy && <Spinner />}
          {busy ? "Saving" : "Save changes"}
        </button>
      </SheetFooter>
    </Modal>
  );
}
