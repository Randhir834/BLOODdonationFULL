import { useState } from "react";
import { Link } from "react-router-dom";
import ConfirmModal from "../../components/ConfirmModal";
import { Empty, ErrorNote } from "../../components/Feedback";
import Modal from "../../components/Modal";
import { AccountStatus, ApprovalStatus, RoleBadge } from "../../components/Status";
import { useToast } from "../../components/toastContext";
import { useApi } from "../../hooks/useApi";
import { useRealtime } from "../../hooks/useRealtime";
import api, { errorMessage } from "../../lib/api";
import { APPROVAL_ROLES } from "../../lib/constants";
import { fmtDateTime, fmtMl, nameOf } from "../../lib/format";
import EditUserModal from "./EditUserModal";
import RejectUserModal from "./RejectUserModal";
import SuspendUserModal from "./SuspendUserModal";

/** One user, everything about them: profile, actions, stock (organisations) and latest blood records. */
export default function UserDetail({ id, onClose, onChanged }) {
  const toast = useToast();
  const { data, error, reload } = useApi(`/users/${id}`);
  // Another admin could be editing this same user right now, or the organisation's stock could be
  // changing in the mobile app while this is open.
  useRealtime(["users", "inventory"], reload);
  const [dialog, setDialog] = useState(null); // "edit" | "suspend" | "approve" | "reject" | "delete" | null
  const [reactivating, setReactivating] = useState(false);

  const user = data?.user;
  const isOrganisation = user?.role === "organisation";
  const needsApproval = APPROVAL_ROLES.includes(user?.role);

  const changed = () => {
    setDialog(null);
    reload();
    onChanged();
  };

  const reactivate = async () => {
    if (reactivating) return;
    setReactivating(true);
    try {
      await api.post(`/users/${id}/reactivate`);
      toast("User reactivated");
      changed();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setReactivating(false);
    }
  };

  const approve = async () => {
    try {
      await api.post(`/users/${id}/approve`);
      toast("Registration approved");
      changed();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const remove = async () => {
    try {
      await api.delete(`/users/${id}`);
      toast("User deleted");
      onChanged();
      onClose();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  return (
    <Modal title={user ? nameOf(user) : "User"} onClose={onClose} wide>
      <ErrorNote message={error} onRetry={reload} />
      {!user && !error && <p className="hint">Loading…</p>}
      {user && (
        <>
          <dl className="kv">
            <dt>Role</dt>
            <dd>
              <RoleBadge role={user.role} />
            </dd>
            <dt>Status</dt>
            <dd>
              <AccountStatus status={user.status} />
              {user.status === "suspended" && user.statusReason && (
                <span className="hint"> · {user.statusReason}</span>
              )}
            </dd>
            {needsApproval && (
              <>
                <dt>Approval</dt>
                <dd>
                  <ApprovalStatus role={user.role} verification={user.verification} />
                  {user.verification === "rejected" && user.verificationReason && (
                    <span className="hint"> · {user.verificationReason}</span>
                  )}
                  {user.verifiedBy && <span className="hint"> · by {user.verifiedBy}</span>}
                </dd>
                <dt>Registration no.</dt>
                <dd>{user.registrationNumber || "-"}</dd>
              </>
            )}
            <dt>Phone</dt>
            <dd>{user.phone}</dd>
            <dt>Address</dt>
            <dd>{user.address || "-"}</dd>
            <dt>Website</dt>
            <dd>{user.website || "-"}</dd>
            <dt>Joined</dt>
            <dd>{fmtDateTime(user.createdAt)}</dd>
          </dl>

          <div className="detail-actions">
            {needsApproval && user.verification !== "approved" && (
              <button type="button" className="btn btn-primary" onClick={() => setDialog("approve")}>
                Approve
              </button>
            )}
            {needsApproval && user.verification !== "rejected" && (
              <button type="button" className="btn" onClick={() => setDialog("reject")}>
                Reject
              </button>
            )}
            <button type="button" className="btn" onClick={() => setDialog("edit")}>
              Edit
            </button>
            {user.status === "suspended" ? (
              <button type="button" className="btn" onClick={reactivate} disabled={reactivating}>
                {reactivating ? "Reactivating…" : "Reactivate"}
              </button>
            ) : (
              <button type="button" className="btn" onClick={() => setDialog("suspend")}>
                Suspend
              </button>
            )}
            <button type="button" className="btn btn-danger" onClick={() => setDialog("delete")}>
              Delete
            </button>
          </div>

          {data.stock && (
            <>
              <h3 className="section-title">Blood in stock at this organisation</h3>
              <div className="mini-stock">
                {Object.entries(data.stock).map(([group, totals]) => (
                  <div key={group}>
                    <b>{group}</b>
                    {fmtMl(totals.available)}
                  </div>
                ))}
              </div>
            </>
          )}

          <h3 className="section-title">Latest blood records</h3>
          {data.records.length === 0 ? (
            <Empty>No blood records for this user.</Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Type</th>
                    <th>Group</th>
                    <th className="num">Amount</th>
                    <th>{isOrganisation ? "Donor / hospital" : "Organisation"}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.records.map((record) => (
                    <tr key={record._id}>
                      <td>{fmtDateTime(record.createdAt)}</td>
                      <td>{record.inventoryType === "in" ? "Added" : "Issued"}</td>
                      <td>{record.bloodGroup}</td>
                      <td className="num">{fmtMl(record.quantity)}</td>
                      <td>
                        {nameOf(isOrganisation ? record.donar || record.hospital : record.organisation)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {isOrganisation && (
            <p className="detail-link">
              <Link to={`/inventory?organisation=${user._id}`}>See all records of this organisation</Link>
            </p>
          )}

          {dialog === "edit" && (
            <EditUserModal user={user} onClose={() => setDialog(null)} onSaved={changed} />
          )}
          {dialog === "suspend" && (
            <SuspendUserModal user={user} onClose={() => setDialog(null)} onDone={changed} />
          )}
          {dialog === "approve" && (
            <ConfirmModal
              title={`Approve ${nameOf(user)}?`}
              message={`Registration number: ${user.registrationNumber || "none given"}. Once approved they can ${
                isOrganisation ? "record blood and see their stock" : "receive blood from blood banks"
              } straight away.`}
              confirmLabel="Approve"
              onConfirm={approve}
              onClose={() => setDialog(null)}
            />
          )}
          {dialog === "reject" && (
            <RejectUserModal user={user} onClose={() => setDialog(null)} onDone={changed} />
          )}
          {dialog === "delete" && (
            <ConfirmModal
              title={`Delete ${nameOf(user)}?`}
              message="This removes the profile and the phone sign-in for good. Their blood records stay in the organisations' history."
              confirmLabel="Delete user"
              confirmText="delete"
              danger
              onConfirm={remove}
              onClose={() => setDialog(null)}
            />
          )}
        </>
      )}
    </Modal>
  );
}
