import { ErrorNote } from "../../components/Feedback";
import { StatusPill } from "../../components/Status";
import { useApi } from "../../hooks/useApi";

function StatusRow({ label, check }) {
  return (
    <div className="status-row">
      <span>{label}</span>
      {check.ok ? (
        <StatusPill kind="good">Working · {check.latencyMs} ms</StatusPill>
      ) : (
        <StatusPill kind="critical">Down · {check.message}</StatusPill>
      )}
    </div>
  );
}

const POLL_MS = 30_000;

/** Is everything the app depends on working? Rechecked periodically while this page stays open. */
export default function SystemStatus() {
  const { data, error } = useApi("/system", undefined, POLL_MS);
  if (error) return <ErrorNote message={error} />;
  if (!data) return <p className="hint">Checking…</p>;

  const { firestore, auth, server } = data.system;
  const hours = Math.floor(server.uptimeSeconds / 3600);
  const minutes = Math.floor((server.uptimeSeconds % 3600) / 60);

  return (
    <div className="status-list">
      <StatusRow label="Database (Firestore)" check={firestore} />
      <StatusRow label="Sign-in (Firebase Auth)" check={auth} />
      <div className="status-row">
        <span>API server</span>
        <span>
          Up {hours}h {minutes}m · {server.mode}
        </span>
      </div>
    </div>
  );
}
