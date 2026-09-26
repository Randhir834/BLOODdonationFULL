import { Geolocation } from "@capacitor/geolocation";
import { useState } from "react";
import { Icon } from "../../components/Icon";
import Modal from "../../components/Modal";
import { SheetBody, SheetFooter, SheetHeader } from "../../components/Sheet";
import Spinner from "../../components/Spinner";
import { ErrorBanner } from "../../components/States";
import { errorMessage } from "../../lib/api";
import { notify } from "../../lib/notify";
import MapView, { DEFAULT_CENTER, DEFAULT_ZOOM } from "../location/MapView";
import { createCamp, updateCamp } from "./campsApi";

const todayKey = () => new Date().toISOString().slice(0, 10);

/** Organisations: registers a new camp, or edits one they already run. */
export default function CampFormSheet({ camp, onClose, onDone }) {
  const editing = !!camp;
  const [name, setName] = useState(camp?.name || "");
  const [address, setAddress] = useState(camp?.address || "");
  const [description, setDescription] = useState(camp?.description || "");
  const [location, setLocation] = useState(camp?.location || null);
  const [startDate, setStartDate] = useState(camp?.startDate || todayKey());
  const [endDate, setEndDate] = useState(camp?.endDate || camp?.startDate || todayKey());
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);

  const clear = (field) => setErrors((current) => ({ ...current, [field]: undefined }));

  const useMyLocation = async () => {
    setLocating(true);
    try {
      // Asking for a position is itself what triggers the permission prompt on both native and web —
      // calling requestPermissions() first is unnecessary and unimplemented on the web platform.
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15_000 });
      setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
      clear("location");
    } catch {
      // The person can still tap the map to place the pin by hand, so say that rather than fail silently.
      notify.warning("Could not get your location");
    } finally {
      setLocating(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    const next = {};
    if (!name.trim()) next.name = "Name is required.";
    if (!address.trim()) next.address = "Address is required.";
    if (!location) next.location = "Tap the map to place the camp's venue.";
    if (endDate < startDate) next.endDate = "End date must be on or after the start date.";
    setErrors(next);
    setServerError("");
    if (Object.keys(next).length) return;

    setBusy(true);
    const body = {
      name: name.trim(),
      address: address.trim(),
      description: description.trim(),
      location,
      startDate,
      endDate,
    };
    try {
      if (editing) await updateCamp(camp._id, body);
      else await createCamp(body);
      if (editing) notify.success("Camp updated");
      else notify.success("Camp added");
      onDone();
    } catch (error) {
      setServerError(errorMessage(error, "Could not save the camp. Please try again."));
      setBusy(false);
    }
  };

  return (
    <Modal as="form" labelledBy="camp-title" onClose={onClose} onSubmit={submit} noValidate>
      <SheetHeader id="camp-title" title={editing ? "Edit camp" : "Add a camp"} onClose={onClose} />
      <SheetBody>
        <ErrorBanner message={serverError} className="mb-16" />

        <div className="field">
          <label className="field-label" htmlFor="camp-name">
            Name
          </label>
          <input
            id="camp-name"
            className={`input ${errors.name ? "invalid" : ""}`}
            value={name}
            aria-invalid={!!errors.name}
            onChange={(event) => {
              setName(event.target.value);
              clear("name");
            }}
          />
          {errors.name && <div className="field-error">{errors.name}</div>}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="camp-address">
            Address
          </label>
          <input
            id="camp-address"
            className={`input ${errors.address ? "invalid" : ""}`}
            value={address}
            aria-invalid={!!errors.address}
            onChange={(event) => {
              setAddress(event.target.value);
              clear("address");
            }}
          />
          {errors.address && <div className="field-error">{errors.address}</div>}
        </div>

        <div className="field">
          <div className="field-label-row">
            <span className="field-label">Venue location</span>
            <button
              type="button"
              className="link-btn link-btn-sm"
              onClick={useMyLocation}
              disabled={locating}
            >
              {locating ? "Locating…" : "Use my location"}
            </button>
          </div>
          <MapView
            center={location ? [location.lat, location.lng] : DEFAULT_CENTER}
            zoom={location ? 14 : DEFAULT_ZOOM}
            onPick={(latlng) => {
              setLocation({ lat: latlng.lat, lng: latlng.lng });
              clear("location");
            }}
            picked={location}
            height={220}
          />
          <div className="field-hint">
            <Icon name="pin" size={16} />
            {location
              ? "Pin placed. Tap elsewhere on the map to move it."
              : "Tap the map to place the camp's venue, or use your current location."}
          </div>
          {errors.location && <div className="field-error">{errors.location}</div>}
        </div>

        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="camp-start">
              Start date
            </label>
            <input
              id="camp-start"
              type="date"
              className="input"
              value={startDate}
              onChange={(event) => {
                const value = event.target.value;
                setStartDate(value);
                if (endDate < value) setEndDate(value);
                clear("endDate");
              }}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="camp-end">
              End date
            </label>
            <input
              id="camp-end"
              type="date"
              className={`input ${errors.endDate ? "invalid" : ""}`}
              min={startDate}
              value={endDate}
              aria-invalid={!!errors.endDate}
              onChange={(event) => {
                setEndDate(event.target.value);
                clear("endDate");
              }}
            />
            {errors.endDate && <div className="field-error">{errors.endDate}</div>}
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="camp-desc">
            Description <span className="muted">(optional)</span>
          </label>
          <textarea
            id="camp-desc"
            className="input"
            maxLength={300}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
      </SheetBody>
      <SheetFooter>
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy && <Spinner />}
          {busy ? "Saving" : editing ? "Save changes" : "Add camp"}
        </button>
      </SheetFooter>
    </Modal>
  );
}
