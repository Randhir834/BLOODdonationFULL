import { Empty, ErrorNote, TruncatedNote } from "../../components/Feedback";
import Pagination from "../../components/Pagination";
import { TableSkeleton } from "../../components/Skeleton";
import { RequestStatus, RoleBadge } from "../../components/Status";
import { useApi } from "../../hooks/useApi";
import { useQueryParams } from "../../hooks/useQueryParams";
import { useRealtime } from "../../hooks/useRealtime";
import { BLOOD_GROUPS, PAGE_SIZE, REQUEST_COMPONENT_LABEL, REQUEST_PRIORITY_LABEL, ROLE_LABEL } from "../../lib/constants";
import { fmtDateTime, fmtMl, nameOf } from "../../lib/format";

const ROLES = Object.keys(ROLE_LABEL);

export default function RequestsPage() {
  const query = useQueryParams();
  const page = Number(query.get("page")) || 1;
  const filters = {
    status: query.get("status"),
    role: query.get("role"),
    bloodGroup: query.get("bloodGroup"),
    q: query.get("q"),
  };
  const filtered = Object.values(filters).some(Boolean);

  const { data, loading, error, reload } = useApi("/requests", { ...filters, page, pageSize: PAGE_SIZE });
  useRealtime("requests", reload);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Blood requests</h1>
          <p>Every request for blood, from every donor, hospital and blood bank in one place.</p>
        </div>
      </div>

      <section className="card">
        <div className="filters">
          <label className="field">
            <span>Requester type</span>
            <select value={filters.role} onChange={(event) => query.update({ role: event.target.value })}>
              <option value="">Anyone</option>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABEL[role]}
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
            <span>Status</span>
            <select value={filters.status} onChange={(event) => query.update({ status: event.target.value })}>
              <option value="">Any status</option>
              <option value="pending">Waiting</option>
              <option value="fulfilled">Fulfilled</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label className="field">
            <span>Patient, location or phone</span>
            <input value={filters.q} onChange={(event) => query.update({ q: event.target.value })} />
          </label>
          {filtered && (
            <button type="button" className="btn btn-small" onClick={query.reset}>
              Clear filters
            </button>
          )}
        </div>

        <ErrorNote message={error} onRetry={reload} />
        <div className={`table-wrap ${loading ? "dim" : ""}`.trim()}>
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Requester</th>
                <th>Patient</th>
                <th>Group</th>
                <th>Component</th>
                <th className="num">Units</th>
                <th>Urgency</th>
                <th>Location</th>
                <th>Blood bank</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {!data && loading && <TableSkeleton columns={10} />}
              {(data?.requests || []).map((request) => (
                <tr key={request._id}>
                  <td>{fmtDateTime(request.createdAt)}</td>
                  <td>
                    {nameOf(request.requester)}
                    <div className="sub">
                      <RoleBadge role={request.requesterRole} /> {request.requesterPhone}
                    </div>
                  </td>
                  <td>{request.patientName}</td>
                  <td>{request.bloodGroup}</td>
                  <td>{REQUEST_COMPONENT_LABEL[request.component] || request.component}</td>
                  <td className="num">{fmtMl(request.quantity)}</td>
                  <td>{REQUEST_PRIORITY_LABEL[request.priority] || request.priority}</td>
                  <td>{request.location}</td>
                  <td>{request.organisation ? nameOf(request.organisation) : "—"}</td>
                  <td>
                    <RequestStatus request={request} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && data.requests.length === 0 && <Empty>No blood requests match these filters.</Empty>}
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
    </div>
  );
}
