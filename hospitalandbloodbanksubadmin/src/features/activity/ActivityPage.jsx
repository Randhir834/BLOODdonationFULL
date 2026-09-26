import { Card } from "../../components/Card";
import { Empty, LoadError, PageHead } from "../../components/Feedback";
import { useApi } from "../../hooks/useApi";
import { ACTION_LABEL } from "../../lib/constants";
import { fmtDateTime } from "../../lib/format";

/** What this account has done, newest first: a record for the organisation's own accountability. */
export default function ActivityPage() {
  const { data, loading, error, reload } = useApi("/activity", { limit: 150 });
  const logs = data?.logs ?? [];

  return (
    <div className="stack">
      <PageHead title="Activity log">
        Every change made from this account, on this website or in the mobile app.
      </PageHead>
      <Card>
        <LoadError message={error} hasData={!!data} onRetry={reload} />
        {!data && loading && <div className="skeleton-card" aria-hidden="true" />}
        {data && logs.length === 0 && (
          <Empty icon="activity" title="Nothing recorded yet" quiet>
            Blood you receive or issue, requests and profile changes are recorded here.
          </Empty>
        )}
        {logs.length > 0 && (
          <ul className={`log-list ${loading ? "dim" : ""}`.trim()}>
            {logs.map((log) => (
              <li key={log._id}>
                <span>
                  <span className="strong">{ACTION_LABEL[log.action] || log.action}</span>
                  {log.targetLabel && <span className="muted"> · {log.targetLabel}</span>}
                </span>
                <span className="hint">{fmtDateTime(log.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
