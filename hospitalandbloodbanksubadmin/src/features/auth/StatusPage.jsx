import { useEffect, useState } from "react";
import { Spinner } from "../../components/Feedback";
import { NavIcon } from "../../components/Icons";
import { VerificationStatus } from "../../components/Status";
import api, { errorMessage } from "../../lib/api";
import { ROLE_LABEL } from "../../lib/constants";
import { formatPhone, orgName } from "../../lib/format";
import { notify } from "../../lib/notify";
import EditProfileModal from "../profile/EditProfileModal";
import { useAuth } from "./authContext";

const CHECK_MS = 30_000;

/**
 * What an account that can not use the website yet sees: waiting for an admin's decision, refused (with the
 * reason, and a way to correct the details and ask again), or suspended. It checks for a decision by itself.
 */
export default function StatusPage() {
  const { user, reload, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);
  const suspended = user.status === "suspended";
  const rejected = !suspended && user.verification === "rejected";

  // A decision arrives while the page is open: look for it now and then (the live feed is for approved accounts).
  useEffect(() => {
    if (suspended) return undefined;
    const timer = setInterval(reload, CHECK_MS);
    return () => clearInterval(timer);
  }, [suspended, reload]);

  const resubmit = async () => {
    setResubmitting(true);
    try {
      await api.post("/profile/resubmit");
      notify.success("Sent for review again");
      await reload();
    } catch (error) {
      notify.error(errorMessage(error));
    } finally {
      setResubmitting(false);
    }
  };

  const heading = suspended
    ? "This account is suspended"
    : rejected
      ? "Your registration was not approved"
      : "Waiting for approval";
  const lead = suspended
    ? "An admin has suspended this account, so it can not be used for now."
    : rejected
      ? "An admin reviewed the registration and could not approve it."
      : "An admin is checking your registration number. This usually does not take long, and this page updates by itself when there is a decision.";
  const reason = suspended ? user.statusReason : rejected ? user.verificationReason : "";

  return (
    <div className="status-page">
      <div className="status-card">
        <NavIcon name={suspended || rejected ? "alertTriangle" : "clock"} size={36} />
        <h1>{heading}</h1>
        <p className="lead">{lead}</p>
        {reason && (
          <p className="reason-box">
            <b>Reason</b>
            {reason}
          </p>
        )}

        <dl className="kv">
          <dt>Organisation</dt>
          <dd>
            {orgName(user)} <span className="muted">({ROLE_LABEL[user.role]})</span>
          </dd>
          <dt>Registration number</dt>
          <dd>{user.registrationNumber || "-"}</dd>
          <dt>Location</dt>
          <dd>{[user.address, user.city].filter(Boolean).join(", ") || "-"}</dd>
          <dt>Phone</dt>
          <dd>{formatPhone(user.phone)}</dd>
          <dt>Status</dt>
          <dd>{suspended ? "Suspended" : <VerificationStatus verification={user.verification} />}</dd>
        </dl>

        <div className="status-actions">
          {!suspended && (
            <button type="button" className="btn" onClick={() => setEditing(true)}>
              Correct details
            </button>
          )}
          {rejected && (
            <button type="button" className="btn btn-primary" onClick={resubmit} disabled={resubmitting}>
              {resubmitting && <Spinner />}
              Send for review again
            </button>
          )}
          {!suspended && !rejected && (
            <button type="button" className="btn" onClick={reload}>
              <NavIcon name="refresh" size={16} />
              Check now
            </button>
          )}
          <button type="button" className="btn" onClick={logout}>
            Sign out
          </button>
        </div>
      </div>
      {editing && <EditProfileModal user={user} onClose={() => setEditing(false)} onSaved={reload} />}
    </div>
  );
}
