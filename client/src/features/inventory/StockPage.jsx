import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { Empty, LoadError, Loading, Notice, RefreshButton, SectionTitle } from "../../components/States";
import { useLoad } from "../../hooks/useLoad";
import { BLOOD_GROUPS, RECORD_TYPES } from "../../lib/constants";
import { fmtNum, nameOf } from "../../lib/format";
import NewRequestSheet from "../requests/NewRequestSheet";
import AddBloodSheet from "./AddBloodSheet";
import RecordRow from "./RecordRow";
import { getOverview } from "./inventoryApi";

const counterpartOf = (record) => (record.inventoryType === RECORD_TYPES.IN ? record.donar : record.hospital);

/** Blood bank home: what is in stock, and what happened lately. */
export default function StockPage() {
  const navigate = useNavigate();
  // One request for the whole screen (stock and the latest records), shown instantly from the last visit.
  const overview = useLoad(getOverview, undefined, "home:overview");
  const [sheet, setSheet] = useState(null); // "in" | "out" | null
  const [requesting, setRequesting] = useState(false);

  const { data, loading, error, reload: refresh } = overview;
  const stock = data?.stock;
  const records = data?.records;

  const byGroup = Object.fromEntries((stock || []).map((group) => [group.bloodGroup, group]));
  const groups = BLOOD_GROUPS.map(
    (name) => byGroup[name] || { bloodGroup: name, totalIn: 0, totalOut: 0, available: 0, expiringSoonMl: 0 }
  );
  const total = groups.reduce((sum, group) => sum + Math.max(0, group.available), 0);
  const added = groups.reduce((sum, group) => sum + group.totalIn, 0);
  const issued = groups.reduce((sum, group) => sum + group.totalOut, 0);
  const expiringSoon = groups.reduce((sum, group) => sum + group.expiringSoonMl, 0);
  // Nothing loaded and it failed: say so once, instead of showing a screen of zeros that looks like real stock.
  const failed = !!error && !data;
  const fullest = Math.max(1, ...groups.map((group) => group.available));

  return (
    <div className="split">
      <div className="stack">
        <LoadError error={error} hasData={!!data} onRetry={refresh} />

        {!failed && (
          <section className="summary" aria-label="Total blood in stock">
            <div className="label">Total in stock</div>
            <div className="value">
              {stock ? fmtNum(total) : "–"}
              <span className="unit">ML</span>
            </div>
            <div className="meta">
              {fmtNum(added)} ML added · {fmtNum(issued)} ML issued
            </div>
          </section>
        )}

        {expiringSoon > 0 && <Notice tone="warning">{fmtNum(expiringSoon)} ML expiring soon</Notice>}

        <div className="actions actions-3">
          <button type="button" className="btn btn-primary" onClick={() => setSheet(RECORD_TYPES.IN)}>
            <Icon name="plus" size={20} /> Add blood
          </button>
          <button type="button" className="btn" onClick={() => setSheet(RECORD_TYPES.OUT)}>
            Issue blood
          </button>
          <button type="button" className="btn" onClick={() => setRequesting(true)}>
            Request blood
          </button>
        </div>

        {!failed && (
          <section>
            <SectionTitle action={<RefreshButton onClick={refresh} loading={loading} />}>
              By blood group
            </SectionTitle>
            <div className="stock" aria-busy={loading && !stock}>
              {groups.map((group) => {
                const empty = group.available <= 0;
                return (
                  <div key={group.bloodGroup} className={`stock-tile ${empty ? "zero" : ""}`.trim()}>
                    <div className="k">{group.bloodGroup}</div>
                    {loading && !stock ? (
                      <span className="v-skel" aria-hidden="true" />
                    ) : (
                      <div className="v">{empty ? "0" : fmtNum(group.available)}</div>
                    )}
                    <div className="u">ML</div>
                    <span className="meter" aria-hidden="true">
                      <span
                        style={{ width: empty ? 0 : `${Math.max(6, (group.available / fullest) * 100)}%` }}
                      />
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {!failed && (
        <section>
          <SectionTitle
            action={
              <Link className="link" to="/records">
                View all
              </Link>
            }
          >
            Recent activity
          </SectionTitle>
          {!records && loading && <Loading rows={3} />}
          {records && records.length === 0 && (
            <div className="group">
              <Empty
                icon="list"
                title="No blood recorded yet"
                action={
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => setSheet(RECORD_TYPES.IN)}
                  >
                    <Icon name="plus" size={16} /> Add blood
                  </button>
                }
              >
                Add blood when a donor gives, or issue it when you send blood to a hospital.
              </Empty>
            </div>
          )}
          {records && records.length > 0 && (
            <ul className="list group">
              {records.map((record) => (
                <RecordRow
                  key={record._id}
                  record={record}
                  title={nameOf(counterpartOf(record) || { phone: record.phone })}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {sheet && (
        <AddBloodSheet
          initialType={sheet}
          onClose={() => setSheet(null)}
          onDone={() => {
            setSheet(null);
            refresh();
          }}
        />
      )}
      {requesting && (
        <NewRequestSheet
          onClose={() => setRequesting(false)}
          onDone={() => {
            setRequesting(false);
            navigate("/requests");
          }}
        />
      )}
    </div>
  );
}
