import { useState } from "react";
import { useSelector } from "react-redux";
import ConfirmDialog from "../../components/ConfirmDialog";
import { Icon } from "../../components/Icon";
import { SectionTitle } from "../../components/States";
import { APPROVAL_ROLES, VERIFICATION } from "../../lib/approval";
import { fmtDay, formatPhone, initialOf, nameOf, ROLE_LABEL } from "../../lib/format";
import { logout } from "../auth/authService";
import LocationPermissionCard from "../location/LocationPermissionCard";
import EditProfileSheet from "./EditProfileSheet";

export default function ProfilePage() {
  const { user } = useSelector((state) => state.auth);
  const [confirming, setConfirming] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [editing, setEditing] = useState(false);

  const verified = APPROVAL_ROLES.includes(user.role) && user.verification === VERIFICATION.APPROVED;

  const details = [
    ["Mobile number", formatPhone(user.phone), "phone"],
    ["Blood group", user.bloodGroup, "drop"],
    ["Address", user.address, "pin"],
    ["City", user.city, "map"],
    ["Website", user.website, "globe"],
    ["Member since", fmtDay(user.createdAt), "calendar"],
  ].filter(([, value]) => value);

  const signOut = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="stack">
      <section className="who">
        <span className="avatar avatar-lg">{initialOf(user)}</span>
        <div className="who-text">
          <h2>{nameOf(user)}</h2>
          <p>
            {ROLE_LABEL[user.role]}
            {verified && (
              <span className="verified">
                <Icon name="shieldCheck" size={16} />
                Verified
              </span>
            )}
          </p>
        </div>
      </section>

      <section>
        <SectionTitle>Details</SectionTitle>
        <div className="group">
          {details.map(([label, value, icon]) => (
            <div className="kv" key={label}>
              <Icon name={icon} />
              <div className="kv-text">
                <div className="k">{label}</div>
                <div className="v">{value}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Settings</SectionTitle>
        <div className="stack stack-tight">
          <div className="group">
            <button type="button" className="menu-row" onClick={() => setEditing(true)}>
              <Icon name="edit" />
              <span className="label">
                Edit profile
                <span className="sub">Change your address and city</span>
              </span>
              <span className="row-chevron">
                <Icon name="chevronRight" size={18} />
              </span>
            </button>
          </div>
          <LocationPermissionCard user={user} />
        </div>
      </section>

      <div className="group">
        <button type="button" className="menu-row danger-row" onClick={() => setConfirming(true)}>
          <Icon name="logout" />
          <span className="label">Log out</span>
        </button>
      </div>

      {confirming && (
        <ConfirmDialog
          id="logout-title"
          title="Log out?"
          message="You will need your phone to sign in again."
          confirmLabel="Log out"
          busy={loggingOut}
          onCancel={() => setConfirming(false)}
          onConfirm={signOut}
        />
      )}
      {editing && (
        <EditProfileSheet user={user} onClose={() => setEditing(false)} onDone={() => setEditing(false)} />
      )}
    </div>
  );
}
