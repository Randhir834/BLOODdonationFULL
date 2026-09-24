import { useState } from "react";
import { useDispatch } from "react-redux";
import { Icon } from "../../components/Icon";
import Switch from "../../components/Switch";
import { errorMessage } from "../../lib/api";
import { fmtAgo } from "../../lib/format";
import { notify } from "../../lib/notify";
import { refreshProfile } from "../auth/authService";
import { setLocationSharing } from "./locationApi";
import { ensureLocationPermission } from "./permission";

const RATIONALE = {
  donar: "Nearby blood banks can find you during an emergency request.",
  hospital: "Donors and blood banks can find you on the map.",
  organisation: "Donors and hospitals can find you on the map.",
};

const DENIED_MESSAGE =
  "Location permission was not granted. Enable location for this app in your device settings, then try again.";

/** The "share my live location" toggle shown on the profile screen, with its permission flow. */
export default function LocationPermissionCard({ user }) {
  const dispatch = useDispatch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const sharing = !!user.locationSharing;
  const lastUpdated = user.location?.updatedAt;

  const toggle = async (next) => {
    setError("");
    setBusy(true);
    try {
      if (next && !(await ensureLocationPermission())) {
        setError(DENIED_MESSAGE);
        return;
      }
      await setLocationSharing(next);
      await refreshProfile(dispatch);
      if (next) notify.success("Location sharing is on", RATIONALE[user.role]);
      else notify.info("Location sharing is off", "Your stored location was deleted.");
    } catch (err) {
      setError(errorMessage(err, "Could not update location sharing. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="group">
      <div className="switch-row">
        <Icon name="pin" />
        <div className="main">
          <div className="title">Share my live location</div>
          <div className="sub">
            {RATIONALE[user.role]}
            {sharing && lastUpdated && ` Last updated ${fmtAgo(lastUpdated)}.`}
          </div>
        </div>
        <Switch checked={sharing} disabled={busy} onChange={toggle} label="Share my live location" />
      </div>
      {error && <div className="row-error">{error}</div>}
    </div>
  );
}
