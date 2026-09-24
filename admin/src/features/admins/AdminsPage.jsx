import { useState } from "react";
import ConfirmModal from "../../components/ConfirmModal";
import { Empty, ErrorNote } from "../../components/Feedback";
import { NavIcon } from "../../components/Icons";
import { TableSkeleton } from "../../components/Skeleton";
import { useToast } from "../../components/toastContext";
import { useApi } from "../../hooks/useApi";
import { useRealtime } from "../../hooks/useRealtime";
import api, { errorMessage } from "../../lib/api";
import { fmtDateTime } from "../../lib/format";
import { useAuth } from "../auth/authContext";
import AddAdminModal from "./AddAdminModal";

export default function AdminsPage() {
  const { admin: me } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useApi("/admins");
  useRealtime("admins", reload);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(null);

  const remove = async () => {
    try {
      await api.delete(`/admins/${removing._id}`);
      toast("Admin removed");
      setRemoving(null);
      reload();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Admins</h1>
          <p>People who can sign in to this website. Users of the mobile app can never get in here.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
          <NavIcon name="plus" size={16} />
          Add admin
        </button>
      </div>

      <section className="card">
        <ErrorNote message={error} onRetry={reload} />
        <div className={`table-wrap ${loading ? "dim" : ""}`.trim()}>
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Added</th>
                <th>Added by</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {!data && loading && <TableSkeleton columns={5} />}
              {(data?.admins || []).map((account) => (
                <tr key={account._id}>
                  <td>
                    {account.email} {account.email === me.email && <span className="badge">You</span>}
                  </td>
                  <td>{account.name || "-"}</td>
                  <td>{fmtDateTime(account.createdAt)}</td>
                  <td>{account.createdBy}</td>
                  <td>
                    <div className="row-actions">
                      {account.email !== me.email && (
                        <button
                          type="button"
                          className="btn btn-small btn-danger"
                          onClick={() => setRemoving(account)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && data.admins.length === 0 && (
            <Empty>
              The list is empty until an admin is added here. Admins created with the create-admin script
              appear here too.
            </Empty>
          )}
        </div>
      </section>

      {adding && (
        <AddAdminModal
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            reload();
          }}
        />
      )}
      {removing && (
        <ConfirmModal
          title={`Remove ${removing.email}?`}
          message="Their account is deleted and they can no longer sign in to this website."
          confirmLabel="Remove admin"
          danger
          onConfirm={remove}
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  );
}
