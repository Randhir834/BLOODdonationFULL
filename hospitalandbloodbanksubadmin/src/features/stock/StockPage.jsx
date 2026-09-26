import { useState } from "react";
import { Link } from "react-router-dom";
import { Empty, LoadError, PageHead, TruncatedNote } from "../../components/Feedback";
import { NavIcon } from "../../components/Icons";
import Pagination from "../../components/Pagination";
import { TableSkeleton } from "../../components/Skeleton";
import { StockLevel, UnitState } from "../../components/Status";
import { useApi } from "../../hooks/useApi";
import { useQueryParams } from "../../hooks/useQueryParams";
import { useRealtime } from "../../hooks/useRealtime";
import { BLOOD_GROUPS, PAGE_SIZE, UNIT_STATE_LABEL } from "../../lib/constants";
import { fmtDate, fmtMl, fmtNum, fmtRelativeDay } from "../../lib/format";
import { useAuth } from "../auth/authContext";
import DeliveriesTab from "./DeliveriesTab";
import DiscardUnitModal from "./DiscardUnitModal";
import EditUnitModal from "./EditUnitModal";
import IssueBloodModal from "./IssueBloodModal";
import ReceiveBloodModal from "./ReceiveBloodModal";

const STATES = ["available", "expired", "issued", "discarded"];

/** One row per blood group: how much is in stock and what needs using or throwing away. */
function GroupTable({ stock, onIssue }) {
  return (
    <div className="table-wrap">
      <table className="cards stock-table">
        <thead>
          <tr>
            <th>Group</th>
            <th className="num">In stock</th>
            <th className="num">Units</th>
            <th className="num">Expiring soon</th>
            <th className="num">Expired</th>
            <th>Next expiry</th>
            <th>Level</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {stock.groups.map((group) => (
            <tr key={group.bloodGroup}>
              <td data-label="Group">
                <Link
                  className="group-tag"
                  to={`/stock?bloodGroup=${encodeURIComponent(group.bloodGroup)}&state=available`}
                >
                  {group.bloodGroup}
                </Link>
              </td>
              <td className="num" data-label="In stock">
                {fmtMl(group.available)}
              </td>
              <td className="num" data-label="Units">
                {fmtNum(group.availableUnits)}
              </td>
              <td className="num" data-label="Expiring soon">
                {group.expiringSoonMl > 0 ? fmtMl(group.expiringSoonMl) : "-"}
              </td>
              <td className="num" data-label="Expired">
                {group.expiredUnits > 0 ? `${fmtMl(group.expiredMl)} (${group.expiredUnits})` : "-"}
              </td>
              <td className="nowrap" data-label="Next expiry">
                {group.nextExpiry ? (
                  <>
                    {fmtDate(group.nextExpiry)}
                    <div className="sub">{fmtRelativeDay(group.nextExpiry)}</div>
                  </>
                ) : (
                  "-"
                )}
              </td>
              <td data-label="Level">
                <StockLevel status={group.status} />
              </td>
              <td>
                <div className="row-actions">
                  <button
                    type="button"
                    className="btn btn-small"
                    disabled={group.available <= 0}
                    onClick={() => onIssue(group.bloodGroup)}
                  >
                    Issue
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td className="num strong">{fmtMl(stock.totalAvailable)}</td>
            <td className="num strong">{fmtNum(stock.totalUnits)}</td>
            <td className="num">{stock.expiringSoonMl > 0 ? fmtMl(stock.expiringSoonMl) : "-"}</td>
            <td className="num">{stock.expiredMl > 0 ? fmtMl(stock.expiredMl) : "-"}</td>
            <td colSpan={3} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function UnitsTab({ role, reloadKey, onEdit, onDiscard }) {
  const query = useQueryParams();
  const page = Number(query.get("page")) || 1;
  const filters = {
    state: query.get("state"),
    bloodGroup: query.get("bloodGroup"),
    q: query.get("q"),
    expiring: query.get("expiring"),
  };
  const sort = query.get("sort") || "newest";
  const filtered = Object.values(filters).some(Boolean);

  const { data, loading, error, reload } = useApi("/stock/units", {
    ...filters,
    sort,
    page,
    pageSize: PAGE_SIZE,
    k: reloadKey,
  });
  useRealtime("stock", reload);
  const bank = role === "organisation";

  return (
    <section className="card">
      <div className="filters">
        <label className="field">
          <span>Search</span>
          <input
            value={filters.q}
            onChange={(event) => query.update({ q: event.target.value })}
            aria-label="Search units"
          />
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
          <select value={filters.state} onChange={(event) => query.update({ state: event.target.value })}>
            <option value="">Any status</option>
            {STATES.map((state) => (
              <option key={state} value={state}>
                {UNIT_STATE_LABEL[state]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Sort</span>
          <select value={sort} onChange={(event) => query.update({ sort: event.target.value }, true)}>
            <option value="newest">Newest first</option>
            <option value="expiry">Soonest to expire</option>
            <option value="quantity">Most blood first</option>
          </select>
        </label>
        <div className="filters-actions">
          <label className="chip-toggle">
            <input
              type="checkbox"
              checked={Boolean(filters.expiring)}
              onChange={(event) => query.update({ expiring: event.target.checked ? "1" : "" })}
            />
            Expiring soon
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
              <th>Unit</th>
              <th>Group</th>
              <th className="num">In stock</th>
              <th>{bank ? "Donor" : "Received from"}</th>
              <th>Expires</th>
              <th>Storage</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {!data && loading && <TableSkeleton columns={8} />}
            {(data?.units || []).map((unit) => (
              <tr key={unit._id}>
                <td data-label="Unit">
                  <span className="strong unit-id">{unit.unitId}</span>
                  {unit.bagNumber && <div className="sub">Bag {unit.bagNumber}</div>}
                </td>
                <td data-label="Group">
                  <span className="group-tag">{unit.bloodGroup}</span>
                </td>
                <td className="num unit-progress" data-label="In stock">
                  {fmtMl(unit.remaining)}
                  {unit.remaining !== unit.quantity && <div className="sub">of {fmtMl(unit.quantity)}</div>}
                </td>
                <td data-label={bank ? "Donor" : "From"}>
                  {unit.counterpartName || "-"}
                  <div className="sub">Received {fmtDate(unit.createdAt)}</div>
                </td>
                <td className="nowrap" data-label="Expires">
                  {fmtDate(unit.expiresAt)}
                  {unit.state === "available" && <div className="sub">{fmtRelativeDay(unit.expiresAt)}</div>}
                </td>
                <td data-label="Storage">{unit.storageLocation || "-"}</td>
                <td data-label="Status">
                  <UnitState unit={unit} />
                </td>
                <td>
                  {(unit.state === "available" || unit.state === "expired") && (
                    <div className="row-actions">
                      <button type="button" className="btn btn-small" onClick={() => onEdit(unit)}>
                        Correct
                      </button>
                      <button
                        type="button"
                        className="btn btn-small btn-danger-quiet"
                        disabled={unit.consumedQuantity > 0}
                        title={
                          unit.consumedQuantity > 0
                            ? "Blood has already been issued from this unit"
                            : undefined
                        }
                        onClick={() => onDiscard(unit)}
                      >
                        Discard
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.units.length === 0 && (
          <Empty
            icon="drop"
            title={filtered ? "No units match these filters" : "No blood in your records yet"}
            action={
              filtered ? (
                <button type="button" className="btn btn-small" onClick={query.reset}>
                  Clear filters
                </button>
              ) : undefined
            }
          >
            {filtered
              ? "Try a different search, or clear the filters."
              : "Add the first unit with the button above and it will be listed here."}
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
  );
}

export default function StockPage() {
  const { user } = useAuth();
  const bank = user.role === "organisation";
  const query = useQueryParams();
  const tab = bank ? "units" : query.get("tab") || "units";
  const { data, loading, error, reload } = useApi("/stock");
  useRealtime("stock", reload);
  const [dialog, setDialog] = useState(null); // { kind: "receive" | "issue" | "edit" | "discard", ... }
  const [version, setVersion] = useState(0);
  const stock = data?.stock;

  const done = () => {
    setDialog(null);
    setVersion((current) => current + 1);
    reload();
  };

  return (
    <div className="stack">
      <PageHead
        title="Blood stock"
        actions={
          <div className="page-actions">
            <button type="button" className="btn btn-primary" onClick={() => setDialog({ kind: "receive" })}>
              <NavIcon name="plus" size={18} />
              {bank ? "Record a donation" : "Add blood"}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setDialog({ kind: "issue" })}
              disabled={!stock || stock.totalAvailable <= 0}
            >
              {bank ? "Issue blood" : "Use for a patient"}
            </button>
          </div>
        }
      >
        {bank
          ? "Every unit you hold, by blood group. Units are issued first-expiring-first."
          : "The blood your hospital holds, by blood group. Units are used first-expiring-first."}
      </PageHead>

      <LoadError message={error} hasData={!!stock} onRetry={reload} />
      {!stock && loading && <div className="card skeleton-card" aria-hidden="true" />}
      {stock && (
        <section className={`card ${loading ? "dim" : ""}`.trim()}>
          <div className="card-head">
            <h2>By blood group</h2>
            <div className="card-actions">
              <span className="hint">Low stock is under {fmtMl(stock.lowStockMl)}</span>
            </div>
          </div>
          <GroupTable stock={stock} onIssue={(group) => setDialog({ kind: "issue", group })} />
          <TruncatedNote truncated={stock.truncated} />
        </section>
      )}

      {!bank && (
        <div className="tabs" role="group" aria-label="Stock views">
          {[
            { id: "units", label: "Units" },
            { id: "deliveries", label: "Deliveries" },
          ].map((entry) => (
            <button
              key={entry.id}
              type="button"
              className="tab"
              aria-pressed={tab === entry.id}
              onClick={() => query.update({ tab: entry.id === "units" ? "" : entry.id, page: "" })}
            >
              {entry.label}
            </button>
          ))}
        </div>
      )}

      {tab === "deliveries" && !bank ? (
        <DeliveriesTab onChanged={done} />
      ) : (
        <UnitsTab
          role={user.role}
          reloadKey={version}
          onEdit={(unit) => setDialog({ kind: "edit", unit })}
          onDiscard={(unit) => setDialog({ kind: "discard", unit })}
        />
      )}

      {dialog?.kind === "receive" && (
        <ReceiveBloodModal role={user.role} onClose={() => setDialog(null)} onDone={done} />
      )}
      {dialog?.kind === "issue" && (
        <IssueBloodModal
          role={user.role}
          stock={stock}
          initialGroup={dialog.group}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      )}
      {dialog?.kind === "edit" && (
        <EditUnitModal unit={dialog.unit} onClose={() => setDialog(null)} onDone={done} />
      )}
      {dialog?.kind === "discard" && (
        <DiscardUnitModal unit={dialog.unit} onClose={() => setDialog(null)} onDone={done} />
      )}
    </div>
  );
}
