import { useState } from "react";
import { Icon } from "../../components/Icon";
import { Empty, LoadError, Loading } from "../../components/States";
import { useLoad } from "../../hooks/useLoad";
import { fmtNum, nameOf } from "../../lib/format";
import PersonRow from "./PersonRow";
import { listDonors, listHospitals, listOrganisations } from "./directoryApi";

// What each list shows: how to load it, an icon, and the texts for an empty list.
const LISTS = {
  donors: {
    load: listDonors,
    icon: "users",
    empty: "No donors yet",
    hint: "Donors appear here after you add their blood from the Home tab.",
    one: "donor",
    many: "donors",
  },
  hospitals: {
    load: listHospitals,
    icon: "hospital",
    empty: "No hospitals yet",
    hint: "Hospitals appear here after you issue blood to them from the Home tab.",
    one: "hospital",
    many: "hospitals",
  },
  // Donors and hospitals see the blood banks they dealt with.
  organisations: {
    load: listOrganisations,
    icon: "building",
    empty: "No blood banks yet",
    hint: "Blood banks appear here once one has recorded blood for you.",
    one: "blood bank",
    many: "blood banks",
  },
};

/** A searchable list of people or blood banks, each with a call button. */
export default function PeoplePage({ kind }) {
  const list = LISTS[kind];
  const { data, loading, error, reload } = useLoad(list.load);
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const rows = (data || []).filter(
    (person) =>
      !needle ||
      [nameOf(person), person.phone, person.address].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(needle)
      )
  );

  return (
    <div className="stack stack-tight">
      <div className="search">
        <Icon name="search" />
        <input
          className="input"
          type="search"
          aria-label="Search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <LoadError error={error} hasData={!!data} onRetry={reload} />
      {!data && loading && <Loading round />}
      {data && rows.length === 0 && (
        <div className="group">
          <Empty
            icon={data.length === 0 ? list.icon : "search"}
            title={data.length === 0 ? list.empty : "No matches"}
            quiet={data.length !== 0}
          >
            {data.length === 0 ? list.hint : "Try a different search."}
          </Empty>
        </div>
      )}
      {rows.length > 0 && (
        <div>
          <div className="list-count" aria-live="polite">
            {fmtNum(rows.length)} {rows.length === 1 ? list.one : list.many}
          </div>
          <ul className="list group">
            {rows.map((person) => (
              <PersonRow key={person._id} person={person} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
