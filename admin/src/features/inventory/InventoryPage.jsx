import { useState } from "react";
import ConfirmModal from "../../components/ConfirmModal";
import { Empty, ErrorNote, TruncatedNote } from "../../components/Feedback";
import Pagination from "../../components/Pagination";
import { TableSkeleton } from "../../components/Skeleton";
import { UnitStatus } from "../../components/Status";
import { useToast } from "../../components/toastContext";
import { useApi } from "../../hooks/useApi";
import { useQueryParams } from "../../hooks/useQueryParams";
import { useRealtime } from "../../hooks/useRealtime";
import api, { errorMessage } from "../../lib/api";
import { BLOOD_GROUPS, PAGE_SIZE, UNIT_STATUS_LABEL } from "../../lib/constants";
import { fmtDate, fmtDateTime, fmtMl, nameOf } from "../../lib/format";

export default function InventoryPage() {
  const toast = useToast();
  const query = useQueryParams();
  const page = Number(query.get("page")) || 1;
  const filters = {
    type: query.get("type"),
    bloodGroup: query.get("bloodGroup"),
    from: query.get("from"),
    to: query.get("to"),
    q: query.get("q"),
    organisation: query.get("organisation"),
    status: query.get("status"),
  };
  const sort = query.get("sort") || "newest";
  const [deleting, setDeleting] = useState(null);

  const { data, loading, error, reload } = useApi("/inventory", {
    ...filters,
    sort,
    page,
    pageSize: PAGE_SIZE,
  });
  useRealtime("inventory", reload);
  // Shown when the list was opened from an organisation's page.
  const organisation = filters.organisation ? data?.records?.[0]?.organisation : null;
  const filtered = Object.values(filters).some(Boolean);

  const remove = async () => {
    try {
      await api.delete(`/inventory/${deleting._id}`);
      toast("Blood record deleted");
      setDeleting(null);
      reload();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Blood records</h1>
          <p>Every blood addition and issue recorded by the organisations.</p>
        </div>
      </div>

      <section className="card">
        <div className="filters">
          <label className="field">
            <span>Type</span>
            <select value={filters.type} onChange={(event) => query.update({ type: event.target.value })}>
              <option value="">Added and issued</option>
              <option value="in">Added (in)</option>
              <option value="out">Issued (out)</option>
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
            <span>From</span>
            <input
              type="date"
              value={filters.from}
              onChange={(event) => query.update({ from: event.target.value })}
            />
          </label>
          <label className="field">
            <span>To</span>
            <input
              type="date"
              value={filters.to}
              onChange={(event) => query.update({ to: event.target.value })}
            />
          </label>
          <label className="field">
            <span>Donor / hospital phone</span>
            <input
              value={filters.q}
              onChange={(event) => query.update({ q: event.target.value })}
            />
          </label>
          <label className="field">
            <span>Unit status</span>
            <select value={filters.status} onChange={(event) => query.update({ status: event.target.value })}>
              <option value="">Any status</option>
              {Object.entries(UNIT_STATUS_LABEL).map(([value, label]) => (
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
              <option value="expiry">Soonest to expire</option>
            </select>
          </label>
          {filters.organisation && (
            <button
              type="button"
              className="btn btn-small"
              onClick={() => query.update({ organisation: "" })}
            >
              Organisation: {organisation ? nameOf(organisation) : "selected"} ×
            </button>
          )}
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
                <th>Type</th>
                <th>Group</th>
                <th className="num">Amount</th>
                <th>Organisation</th>
                <th>Donor / hospital</th>
                <th>Unit</th>
                <th>Expires</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {!data && loading && <TableSkeleton columns={9} />}
              {(data?.records || []).map((record) => {
                const person = record.inventoryType === "in" ? record.donar : record.hospital;
                return (
                  <tr key={record._id}>
                    <td>{fmtDateTime(record.createdAt)}</td>
                    <td>{record.inventoryType === "in" ? "Added" : "Issued"}</td>
                    <td>{record.bloodGroup}</td>
                    <td className="num">{fmtMl(record.quantity)}</td>
                    <td>{nameOf(record.organisation)}</td>
                    <td>
                      {nameOf(person)}
                      <div className="sub">{record.phone}</div>
                    </td>
                    <td>
                      <UnitStatus record={record} />
                    </td>
                    <td>{record.inventoryType === "in" ? fmtDate(record.expiresAt) : "-"}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-small btn-danger"
                          onClick={() => setDeleting(record)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {data && data.records.length === 0 && <Empty>No blood records match these filters.</Empty>}
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

      {deleting && (
        <ConfirmModal
          title="Delete this blood record?"
          message={`${deleting.inventoryType === "in" ? "Added" : "Issued"} ${fmtMl(deleting.quantity)} of ${deleting.bloodGroup} on ${fmtDateTime(deleting.createdAt)}. The stock totals are corrected automatically. This can not be undone.`}
          confirmLabel="Delete record"
          danger
          onConfirm={remove}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
