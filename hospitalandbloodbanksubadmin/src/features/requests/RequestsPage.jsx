import { useState } from "react";
import { Link } from "react-router-dom";
import { Empty, LoadError, PageHead, Spinner, TruncatedNote } from "../../components/Feedback";
import { NavIcon } from "../../components/Icons";
import Pagination from "../../components/Pagination";
import { TableSkeleton } from "../../components/Skeleton";
import { PriorityFlag, RequestState } from "../../components/Status";
import { useApi } from "../../hooks/useApi";
import { useQueryParams } from "../../hooks/useQueryParams";
import { useRealtime } from "../../hooks/useRealtime";
import { download, errorMessage } from "../../lib/api";
import {
  BLOOD_GROUPS,
  PAGE_SIZE,
  REQUEST_PRIORITY_LABEL,
  REQUEST_STATUS_LABEL,
  RELATION_LABEL,
} from "../../lib/constants";
import { fmtAgo, fmtDate, fmtMl, fmtNum, nameOf } from "../../lib/format";
import { notify } from "../../lib/notify";
import NewRequestModal from "./NewRequestModal";
import OfferModal from "./OfferModal";
import { yourPart } from "./requestText";

const STATS = [
  { key: "needsAction", label: "Waiting for you", params: { needsAction: "1" }, accent: true },
  { key: "open", label: "Open requests", params: { status: "pending" } },
  {
    key: "emergency",
    label: "Emergencies nearby",
    params: { priority: "emergency", status: "pending", relation: "city" },
  },
  { key: "mine", label: "Raised by you", params: { relation: "mine" } },
];

export default function RequestsPage() {
  const query = useQueryParams();
  const page = Number(query.get("page")) || 1;
  const filters = {
    q: query.get("q"),
    relation: query.get("relation"),
    status: query.get("status"),
    bloodGroup: query.get("bloodGroup"),
    priority: query.get("priority"),
    needsAction: query.get("needsAction"),
    dismissed: query.get("dismissed"),
    from: query.get("from"),
    to: query.get("to"),
  };
  const sort = query.get("sort") || "newest";
  const filtered = Object.values(filters).some(Boolean);

  const { data, loading, error, reload } = useApi("/requests", {
    ...filters,
    sort,
    page,
    pageSize: PAGE_SIZE,
  });
  useRealtime("requests", reload);
  const [creating, setCreating] = useState(false);
  const [offering, setOffering] = useState(null);
  const [exporting, setExporting] = useState(false);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await download("/reports/requests.csv", filters);
    } catch (err) {
      notify.error(errorMessage(err, "Could not export the requests."));
    } finally {
      setExporting(false);
    }
  };

  const stats = data?.stats;
  return (
    <div className="stack">
      <PageHead
        title="Blood requests"
        actions={
          <div className="page-actions">
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              <NavIcon name="plus" size={18} />
              Request blood
            </button>
            <button
              type="button"
              className="btn"
              onClick={exportCsv}
              disabled={exporting || !data || data.total === 0}
            >
              {exporting ? <Spinner /> : <NavIcon name="download" size={18} />}
              Export
            </button>
          </div>
        }
      >
        Requests you raised, requests sent to you, and every request in your city, in one list. Requests
        raised in the mobile app appear here too.
      </PageHead>

      {stats && (
        <div className="headline">
          {STATS.map((stat) => (
            <Link
              key={stat.key}
              className={`stat ${stat.accent && stats[stat.key] > 0 ? "stat-attention" : ""}`.trim()}
              to={`/requests?${new URLSearchParams(stat.params)}`}
            >
              <span className="stat-label">{stat.label}</span>
              <span className="stat-value">{fmtNum(stats[stat.key])}</span>
            </Link>
          ))}
        </div>
      )}

      <section className="card">
        <div className="filters">
          <label className="field">
            <span>Search</span>
            <input
              value={filters.q}
              onChange={(event) => query.update({ q: event.target.value })}
              aria-label="Search requests"
            />
          </label>
          <label className="field">
            <span>Show</span>
            <select
              value={filters.relation}
              onChange={(event) => query.update({ relation: event.target.value })}
            >
              <option value="">Everything</option>
              {Object.entries(RELATION_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Status</span>
            <select value={filters.status} onChange={(event) => query.update({ status: event.target.value })}>
              <option value="">Any status</option>
              {Object.entries(REQUEST_STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Blood group</span>
            <select
              value={filters.bloodGroup}
              onChange={(event) => query.update({ bloodGroup: event.target.value })}
            >
              <option value="">All groups</option>
              {BLOOD_GROUPS.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Priority</span>
            <select
              value={filters.priority}
              onChange={(event) => query.update({ priority: event.target.value })}
            >
              <option value="">Any priority</option>
              {Object.entries(REQUEST_PRIORITY_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Sort</span>
            <select value={sort} onChange={(event) => query.update({ sort: event.target.value }, true)}>
              <option value="newest">Newest first</option>
              <option value="priority">Most urgent first</option>
              <option value="needed">Needed soonest</option>
            </select>
          </label>
          <label className="field">
            <span>Raised from</span>
            <input
              type="date"
              value={filters.from}
              onChange={(event) => query.update({ from: event.target.value })}
            />
          </label>
          <label className="field">
            <span>Raised to</span>
            <input
              type="date"
              value={filters.to}
              onChange={(event) => query.update({ to: event.target.value })}
            />
          </label>
          <div className="filters-actions">
            <label className="chip-toggle">
              <input
                type="checkbox"
                checked={Boolean(filters.needsAction)}
                onChange={(event) => query.update({ needsAction: event.target.checked ? "1" : "" })}
              />
              Waiting for you
            </label>
            <label className="chip-toggle">
              <input
                type="checkbox"
                checked={Boolean(filters.dismissed)}
                onChange={(event) => query.update({ dismissed: event.target.checked ? "1" : "" })}
              />
              Hidden by you
            </label>
            {filtered && (
              <button type="button" className="btn btn-small" onClick={query.reset}>
                Clear filters
              </button>
            )}
          </div>
        </div>

        <LoadError message={error} hasData={!!data} onRetry={reload} />
        <div className={`table-wrap ${loading && data ? "dim" : ""}`.trim()} hidden={!!error && !data}>
          <table className="cards cards-xl">
            <thead>
              <tr>
                <th>Group</th>
                <th>Patient</th>
                <th className="num">Amount</th>
                <th>Raised by</th>
                <th>Needed by</th>
                <th>Your part</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {!data && loading && <TableSkeleton columns={8} />}
              {(data?.requests || []).map((request) => (
                <tr key={request._id}>
                  <td data-label="Group">
                    <span className="group-tag">{request.bloodGroup}</span>
                  </td>
                  <td data-label="Patient">
                    <div className="title-line">
                      <Link className="cell-link" to={`/requests/${request._id}`}>
                        {request.patientName}
                      </Link>
                      <PriorityFlag priority={request.priority} />
                    </div>
                    <div className="sub">{request.location}</div>
                  </td>
                  <td className="num" data-label="Amount">
                    {fmtMl(request.quantity)}
                  </td>
                  <td data-label="Raised by">
                    {request.relation === "mine" ? "You" : nameOf(request.requester)}
                    <div className="sub">{fmtAgo(request.createdAt)}</div>
                  </td>
                  <td className="nowrap" data-label="Needed by">
                    {request.requiredAt ? fmtDate(request.requiredAt) : "-"}
                  </td>
                  <td data-label="Your part">
                    <span className={request.needsAction ? "strong" : undefined}>{yourPart(request)}</span>
                  </td>
                  <td data-label="Status">
                    <RequestState request={request} />
                  </td>
                  <td>
                    <div className="row-actions">
                      {request.actions.includes("respond") && (
                        <button
                          type="button"
                          className="btn btn-small btn-primary"
                          onClick={() => setOffering(request)}
                        >
                          Respond
                        </button>
                      )}
                      <Link className="btn btn-small" to={`/requests/${request._id}`}>
                        View
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && data.requests.length === 0 && (
            <Empty
              icon="clipboard"
              title={filtered ? "No requests match these filters" : "No requests yet"}
              action={
                filtered ? (
                  <button type="button" className="btn btn-small" onClick={query.reset}>
                    Clear filters
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-small btn-primary"
                    onClick={() => setCreating(true)}
                  >
                    Request blood
                  </button>
                )
              }
            >
              {filtered
                ? "Try a different search, or clear the filters."
                : "Requests you raise, requests sent to you and requests from others in your city will appear here."}
            </Empty>
          )}
        </div>
        {data && (
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPage={(next) => query.update({ page: String(next) }, true)}
          />
        )}
        <TruncatedNote truncated={data?.truncated} />
      </section>

      {creating && (
        <NewRequestModal
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
      {offering && (
        <OfferModal
          request={offering}
          onClose={() => setOffering(null)}
          onDone={() => {
            setOffering(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
