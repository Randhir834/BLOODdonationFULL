import { useState } from "react";
import { Icon } from "../../components/Icon";
import { Empty, LoadError, Loading } from "../../components/States";
import { useLoad } from "../../hooks/useLoad";
import { RECORD_TYPES } from "../../lib/constants";
import { groupByDay, nameOf } from "../../lib/format";
import DiscardUnitSheet from "./DiscardUnitSheet";
import RecordRow from "./RecordRow";
import { listRecords } from "./inventoryApi";

const FILTERS = [
  { id: "all", label: "All" },
  { id: RECORD_TYPES.IN, label: "Added" },
  { id: RECORD_TYPES.OUT, label: "Issued" },
];

const counterpartOf = (record) => (record.inventoryType === RECORD_TYPES.IN ? record.donar : record.hospital);

/** Blood bank: every blood movement, by day. Filter by type, search by name, phone or blood group. */
export default function RecordsPage() {
  const { data, loading, error, reload } = useLoad(listRecords);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [discarding, setDiscarding] = useState(null); // the record being discarded, or null

  const needle = query.trim().toLowerCase();
  const rows = (data || []).filter((record) => {
    if (filter !== "all" && record.inventoryType !== filter) return false;
    if (!needle) return true;
    return [nameOf(counterpartOf(record)), record.phone, record.bloodGroup].some((value) =>
      String(value || "")
        .toLowerCase()
        .includes(needle)
    );
  });

  return (
    <div className="stack stack-tight">
      <div className="search">
        <Icon name="search" />
        <input
          className="input"
          type="search"
          aria-label="Search records"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="seg" role="group" aria-label="Type">
        {FILTERS.map((option) => (
          <button
            type="button"
            key={option.id}
            aria-pressed={filter === option.id}
            onClick={() => setFilter(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <LoadError error={error} hasData={!!data} onRetry={reload} />
      {!data && loading && <Loading />}
      {data && rows.length === 0 && (
        <div className="group">
          <Empty
            icon={data.length === 0 ? "list" : "search"}
            title={data.length === 0 ? "No records yet" : "No matching records"}
          >
            {data.length === 0
              ? "Blood you add or issue from the Home tab is listed here."
              : "Try a different search or filter."}
          </Empty>
        </div>
      )}
      {groupByDay(rows).map((day) => (
        <div key={day.heading}>
          <h3 className="day">{day.heading}</h3>
          <ul className="list group">
            {day.rows.map((record) => (
              <RecordRow
                key={record._id}
                record={record}
                title={nameOf(counterpartOf(record) || { phone: record.phone })}
                time
                onDiscard={setDiscarding}
              />
            ))}
          </ul>
        </div>
      ))}

      {discarding && (
        <DiscardUnitSheet
          record={discarding}
          onClose={() => setDiscarding(null)}
          onDone={() => {
            setDiscarding(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
