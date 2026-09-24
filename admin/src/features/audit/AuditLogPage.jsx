import { useState } from "react";
import { Empty, LoadError, PageHead } from "../../components/Feedback";
import { TableSkeleton } from "../../components/Skeleton";
import { useApi } from "../../hooks/useApi";
import { useRealtime } from "../../hooks/useRealtime";
import { ACTION_LABEL, ROLE_LABEL, fmtDateTime } from "../../lib/format";

// Older entries have no `actorType`, they were all written by admins.
const actorType = (log) => log.actorType || "admin";

const WHO_FILTERS = [
  { value: "", label: "Everyone" },
  { value: "admin", label: "Admins" },
  { value: "user", label: "Blood banks, hospitals and donors" },
];

/** One plain sentence about what changed, the raw details stay one click away. */
function Summary({ log }) {
  const details = log.details || {};
  if (
    (log.action === "user.suspend" || log.action === "user.reject" || log.action === "request.reject") &&
    details.reason
  ) {
    return <>Reason: {details.reason}</>;
  }
  if (log.action === "request.create" && details.priority && details.priority !== "normal") {
    return <>Priority: {details.priority}</>;
  }
  if (log.action === "user.register") {
    const role = ROLE_LABEL[details.role] || "user";
    return <>Signed up as {details.verification === "pending" ? `${role}, waiting for approval` : role}</>;
  }
  if ((log.action === "inventory.add" || log.action === "inventory.issue") && details.phone) {
    return (
      <>
        {log.action === "inventory.add" ? "From donor" : "To hospital"} {details.phone}
      </>
    );
  }
  if (log.action === "user.update" && details.before && details.after) {
    const changes = Object.keys(details.after).filter((key) => details.before[key] !== details.after[key]);
    if (changes.length === 0) return <>No visible change</>;
    return (
      <>
        {changes
          .map((key) => `${key}: ${details.before[key] || "-"} → ${details.after[key] || "-"}`)
          .join(" · ")}
      </>
    );
  }
  return null;
}

function Who({ log }) {
  const type = actorType(log);
  return (
    <>
      {log.actorLabel || log.adminEmail || "-"}
      <div className="sub">{type === "admin" ? "Admin" : ROLE_LABEL[log.actorRole] || "User"}</div>
    </>
  );
}

export default function AuditLogPage() {
  const { data, loading, error, reload } = useApi("/audit-logs", { limit: 200 });
  useRealtime("audit", reload);
  const [who, setWho] = useState("");

  const logs = (data?.logs || []).filter((log) => !who || actorType(log) === who);

  return (
    <div className="stack">
      <PageHead title="Activity log">
        What admins did on this website, and what blood banks and hospitals did in the app. It can not be
        edited.
      </PageHead>

      <section className="card">
        <div className="filters">
          <label className="field">
            <span>Done by</span>
            <select value={who} onChange={(event) => setWho(event.target.value)}>
              {WHO_FILTERS.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <LoadError message={error} hasData={!!data} onRetry={reload} />
        <div className={`table-wrap ${loading ? "dim" : ""}`.trim()} hidden={!!error && !data}>
          <table className="cards">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Action</th>
                <th>On</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {!data && loading && <TableSkeleton columns={5} />}
              {logs.map((log) => (
                <tr key={log._id}>
                  <td data-label="When">{fmtDateTime(log.at)}</td>
                  <td data-label="Who">
                    <Who log={log} />
                  </td>
                  <td data-label="Action">{ACTION_LABEL[log.action] || log.action}</td>
                  <td data-label="On">{log.targetLabel || "-"}</td>
                  <td data-label="Details">
                    <Summary log={log} />
                    {log.details && Object.keys(log.details).length > 0 && (
                      <details>
                        <summary>Raw details</summary>
                        <pre>{JSON.stringify(log.details, null, 2)}</pre>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && data.logs.length === 0 && <Empty>Nothing has been done yet.</Empty>}
          {data && data.logs.length > 0 && logs.length === 0 && (
            <Empty>Nothing matches this filter in the latest {data.logs.length} entries.</Empty>
          )}
        </div>
      </section>
    </div>
  );
}
