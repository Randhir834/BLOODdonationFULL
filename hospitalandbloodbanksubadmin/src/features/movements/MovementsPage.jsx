import { useState } from "react";
import { Empty, LoadError, PageHead, Spinner, TruncatedNote } from "../../components/Feedback";
import { NavIcon } from "../../components/Icons";
import Pagination from "../../components/Pagination";
import { TableSkeleton } from "../../components/Skeleton";
import { StatusPill } from "../../components/Status";
import { useApi } from "../../hooks/useApi";
import { useQueryParams } from "../../hooks/useQueryParams";
import { useRealtime } from "../../hooks/useRealtime";
import { download, errorMessage } from "../../lib/api";
import { BLOOD_GROUPS, DISCARD_REASON_LABEL, MOVEMENT_LABEL, PAGE_SIZE } from "../../lib/constants";
import { fmtDateTime, fmtMl } from "../../lib/format";
import { notify } from "../../lib/notify";
import { useAuth } from "../auth/authContext";

const KIND_PILL = { received: "good", issued: "info", discarded: "critical" };

/** Every time blood came in, went out or was thrown away, newest first, with a spreadsheet export. */
export default function MovementsPage() {
  const { user } = useAuth();
  const bank = user.role === "organisation";
  const query = useQueryParams();
  const page = Number(query.get("page")) || 1;
  const filters = {
    kind: query.get("kind"),
    bloodGroup: query.get("bloodGroup"),
    from: query.get("from"),
    to: query.get("to"),
    q: query.get("q"),
  };
  const filtered = Object.values(filters).some(Boolean);
  const { data, loading, error, reload } = useApi("/stock/movements", {
    ...filters,
    page,
    pageSize: PAGE_SIZE,
  });
  useRealtime("stock", reload);
  const [exporting, setExporting] = useState(false);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await download("/reports/movements.csv", {
        from: filters.from,
        to: filters.to,
        kind: filters.kind,
        bloodGroup: filters.bloodGroup,
        q: filters.q,
      });
    } catch (err) {
      notify.error(errorMessage(err, "Could not export the history."));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="stack">
      <PageHead
        title="Movement history"
        actions={
          <button
            type="button"
            className="btn"
            onClick={exportCsv}
            disabled={exporting || !data || data.total === 0}
          >
            {exporting ? <Spinner /> : <NavIcon name="download" size={18} />}
            Export to spreadsheet
          </button>
        }
      >
        Every unit received, issued or discarded. The export covers what the filters below show.
      </PageHead>

      <section className="card">
        <div className="filters">
          <label className="field">
            <span>Search</span>
            <input
              value={filters.q}
              onChange={(event) => query.update({ q: event.target.value })}
              aria-label="Search movements"
            />
          </label>
          <label className="field">
            <span>Type</span>
            <select value={filters.kind} onChange={(event) => query.update({ kind: event.target.value })}>
              <option value="">All movements</option>
              {Object.entries(MOVEMENT_LABEL).map(([value, label]) => (
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
          {filtered && (
            <div className="filters-actions">
              <button type="button" className="btn btn-small" onClick={query.reset}>
                Clear filters
              </button>
            </div>
          )}
        </div>

        <LoadError message={error} hasData={!!data} onRetry={reload} />
        <div className={`table-wrap ${loading && data ? "dim" : ""}`.trim()} hidden={!!error && !data}>
          <table className="cards cards-xl">
            <thead>
              <tr>
                <th>When</th>
                <th>Type</th>
                <th>Group</th>
                <th className="num">Amount</th>
                <th>Unit</th>
                <th>{bank ? "Donor / issued to" : "From / used for"}</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {!data && loading && <TableSkeleton columns={7} />}
              {(data?.movements || []).map((movement) => (
                <tr key={movement._id}>
                  <td className="nowrap" data-label="When">
                    {fmtDateTime(movement.at)}
                  </td>
                  <td data-label="Type">
                    <StatusPill kind={KIND_PILL[movement.kind]}>{MOVEMENT_LABEL[movement.kind]}</StatusPill>
                  </td>
                  <td data-label="Group">
                    <span className="group-tag">{movement.bloodGroup}</span>
                  </td>
                  <td className="num" data-label="Amount">
                    {fmtMl(movement.quantity)}
                  </td>
                  <td data-label="Unit">
                    {movement.unitId ||
                      (movement.unitsConsumed
                        ? `${movement.unitsConsumed.length} unit${movement.unitsConsumed.length === 1 ? "" : "s"}`
                        : "-")}
                  </td>
                  <td data-label="With">
                    {movement.counterpartName || "-"}
                    {movement.phone && <div className="sub">{movement.phone}</div>}
                  </td>
                  <td data-label="Details">
                    {[
                      movement.reference,
                      movement.reason && DISCARD_REASON_LABEL[movement.reason],
                      movement.openingBalance && "Opening balance",
                      movement.requestId && "For a blood request",
                      movement.receipt && "Delivery confirmed",
                      movement.note,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && data.movements.length === 0 && (
            <Empty
              icon="list"
              title={filtered ? "No movements match these filters" : "Nothing has moved yet"}
            >
              {filtered
                ? "Try a wider date range, or clear the filters."
                : "Blood you receive, issue or discard is listed here."}
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
    </div>
  );
}
