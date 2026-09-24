import { useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { Empty, LoadError, Loading, RefreshButton, SectionTitle } from "../../components/States";
import { useLoad } from "../../hooks/useLoad";
import { RECORD_TYPES, ROLES } from "../../lib/constants";
import { fmtDay, fmtNum, groupByDay, nameOf } from "../../lib/format";
import NewRequestSheet from "../requests/NewRequestSheet";
import RecordRow from "./RecordRow";
import { listMyRecords } from "./inventoryApi";

const noun = (donor, count) => {
  if (donor) return count === 1 ? "donation" : "donations";
  return count === 1 ? "delivery" : "deliveries";
};

/** Donor: the blood I gave. Hospital: the blood I received. Blood banks record it using my phone number. */
export default function MyBloodPage() {
  const { user } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const donor = user.role === ROLES.DONOR;
  const { data, loading, error, reload } = useLoad(
    listMyRecords,
    { type: donor ? RECORD_TYPES.IN : RECORD_TYPES.OUT },
    "home:mine"
  );
  const [requesting, setRequesting] = useState(false);

  const total = (data || []).reduce((sum, record) => sum + record.quantity, 0);
  const last = data?.[0];

  return (
    <div className="split">
      <div className="stack">
        <section className="summary" aria-label="Summary">
          <div className="label">{donor ? "Total donated" : "Total received"}</div>
          <div className="value">
            {data ? fmtNum(total) : "–"}
            <span className="unit">ML</span>
          </div>
          <div className="meta">
            {data
              ? `${fmtNum(data.length)} ${noun(donor, data.length)}${last ? ` · last on ${fmtDay(last.createdAt)}` : ""}`
              : " "}
          </div>
        </section>

        <div className="actions">
          <button type="button" className="btn btn-primary btn-block" onClick={() => setRequesting(true)}>
            <Icon name="plus" size={20} /> Request blood
          </button>
        </div>
      </div>

      <section>
        <SectionTitle action={<RefreshButton onClick={reload} loading={loading} />}>History</SectionTitle>
        <LoadError error={error} hasData={!!data} onRetry={reload} />
        {!data && loading && <Loading />}
        {data && data.length === 0 && (
          <div className="group">
            <Empty icon="drop" title={donor ? "No donations yet" : "Nothing received yet"}>
              {donor
                ? "When a blood bank records your donation using your phone number, it will show up here."
                : "When a blood bank records blood sent to your hospital, it will show up here."}
            </Empty>
          </div>
        )}
        {data &&
          groupByDay(data).map((day) => (
            <div key={day.heading}>
              <h3 className="day">{day.heading}</h3>
              <ul className="list group">
                {day.rows.map((record) => (
                  <RecordRow key={record._id} record={record} title={nameOf(record.organisation)} time />
                ))}
              </ul>
            </div>
          ))}
      </section>

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
