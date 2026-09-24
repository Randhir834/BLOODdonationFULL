import { useState } from "react";
import { Card } from "../../components/Card";
import { Notice, PageHead } from "../../components/Feedback";
import { VerificationStatus } from "../../components/Status";
import api, { errorMessage } from "../../lib/api";
import { ROLE_LABEL } from "../../lib/constants";
import { fmtDate, formatPhone, orgName } from "../../lib/format";
import { notify } from "../../lib/notify";
import { useAuth } from "../auth/authContext";
import EditProfileModal from "./EditProfileModal";

const dash = (value) => value || "-";

/** The organisation's details as an admin sees them, with a way to correct them and to share the location. */
export default function ProfilePage() {
  const { user, reload } = useAuth();
  const [editing, setEditing] = useState(false);
  const [locating, setLocating] = useState(false);
  const sharing = Boolean(user.locationSharing && user.location);

  const share = () => {
    if (!navigator.geolocation) return notify.error("This browser can not share a location.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          await api.patch("/location", {
            lat: coords.latitude,
            lng: coords.longitude,
            accuracy: coords.accuracy,
          });
          await reload();
          notify.success("Your location is now on the nearby map");
        } catch (error) {
          notify.error(errorMessage(error));
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        notify.error("Could not read this device's location. Allow location access and try again.");
      },
      { enableHighAccuracy: true, timeout: 15_000 }
    );
  };

  const stop = async () => {
    setLocating(true);
    try {
      await api.patch("/location/sharing", { enabled: false });
      await reload();
      notify.success("Your location is no longer shared");
    } catch (error) {
      notify.error(errorMessage(error));
    } finally {
      setLocating(false);
    }
  };

  return (
    <div className="stack">
      <PageHead
        title="Profile"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditing(true)}>
            Edit details
          </button>
        }
      >
        How your organisation appears to admins, and where blood requests raised in your city reach you.
      </PageHead>

      {!user.city && (
        <Notice tone="warning" title="Add your city">
          Blood requests are shown to the organisations in the same city. Edit your details and add yours to
          see them.
        </Notice>
      )}

      <div className="grid-2 start">
        <Card title="Organisation">
          <dl className="kv">
            <dt>Name</dt>
            <dd>{orgName(user)}</dd>
            <dt>Type</dt>
            <dd>{ROLE_LABEL[user.role]}</dd>
            <dt>Registration number</dt>
            <dd>{dash(user.registrationNumber)}</dd>
            <dt>Approval</dt>
            <dd>
              <VerificationStatus verification={user.verification} />
              {user.verifiedAt && <span className="hint"> · {fmtDate(user.verifiedAt)}</span>}
            </dd>
            <dt>Sign-in number</dt>
            <dd>{formatPhone(user.phone)}</dd>
            <dt>Website</dt>
            <dd>{user.website ? <a href={user.website}>{user.website}</a> : "-"}</dd>
            <dt>About</dt>
            <dd>{dash(user.about)}</dd>
          </dl>
        </Card>

        <div className="stack">
          <Card title="Address">
            <dl className="kv">
              <dt>Street</dt>
              <dd>{dash(user.address)}</dd>
              <dt>City</dt>
              <dd>{dash(user.city)}</dd>
              <dt>State</dt>
              <dd>{dash(user.state)}</dd>
              <dt>PIN code</dt>
              <dd>{dash(user.pincode)}</dd>
            </dl>
          </Card>
          <Card title="Contact and hours">
            <dl className="kv">
              <dt>Contact person</dt>
              <dd>{dash(user.contactPerson)}</dd>
              <dt>Email</dt>
              <dd>{user.email ? <a href={`mailto:${user.email}`}>{user.email}</a> : "-"}</dd>
              <dt>Alternate phone</dt>
              <dd>{user.alternatePhone ? formatPhone(user.alternatePhone) : "-"}</dd>
              <dt>Emergency helpline</dt>
              <dd>{user.emergencyPhone ? formatPhone(user.emergencyPhone) : "-"}</dd>
              <dt>Hours</dt>
              <dd>{user.open24x7 ? "Open 24 hours" : dash(user.hours)}</dd>
            </dl>
          </Card>
        </div>
      </div>

      <Card title="Nearby map">
        <p>
          {sharing
            ? "Your organisation is shown on the nearby map in the mobile app."
            : "Share this device's location to appear on the nearby map in the mobile app, so people can find you."}
        </p>
        <div className="status-actions">
          <button type="button" className="btn" onClick={share} disabled={locating}>
            {sharing ? "Update my location" : "Share my location"}
          </button>
          {sharing && (
            <button type="button" className="btn btn-danger-quiet" onClick={stop} disabled={locating}>
              Stop sharing
            </button>
          )}
        </div>
      </Card>

      {editing && <EditProfileModal user={user} onClose={() => setEditing(false)} onSaved={reload} />}
    </div>
  );
}
