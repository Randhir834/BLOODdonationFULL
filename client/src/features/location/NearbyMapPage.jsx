import { Geolocation } from "@capacitor/geolocation";
import { useState } from "react";
import { Icon } from "../../components/Icon";
import { Empty, LoadError, Loading } from "../../components/States";
import { useLoad } from "../../hooks/useLoad";
import { nameOf } from "../../lib/format";
import { distanceKm, fmtDistance, sortByDistance } from "../../lib/geo";
import { notify } from "../../lib/notify";
import MapView, { DEFAULT_CENTER, DEFAULT_ZOOM } from "./MapView";
import { fetchNearby } from "./locationApi";

const KIND_LABEL = { hospital: "Hospital", organisation: "Blood bank", camp: "Blood camp" };
const KIND_ICON = { hospital: "hospital", organisation: "building", camp: "tent" };
const FILTERS = [
  { id: "all", label: "All" },
  { id: "organisation", label: "Blood banks" },
  { id: "hospital", label: "Hospitals" },
  { id: "camp", label: "Camps" },
];
const MAP_HEIGHT = "clamp(15rem, 44vh, 30rem)";

/** Hospitals, blood banks and active camps that are sharing their location, on a map and a list. */
export default function NearbyMapPage() {
  const { data, loading, error, reload } = useLoad(fetchNearby);
  const [myPosition, setMyPosition] = useState(null);
  const [locating, setLocating] = useState(false);
  const [filter, setFilter] = useState("all");

  const useMyLocation = async () => {
    setLocating(true);
    try {
      // Asking for a position is itself what triggers the permission prompt on both native and web —
      // calling requestPermissions() first is unnecessary and unimplemented on the web platform.
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15_000 });
      setMyPosition({ lat: position.coords.latitude, lng: position.coords.longitude });
    } catch {
      // The map still works centred on the default view, so this is a heads-up rather than an error.
      notify.warning("Could not get your location", "Allow location access for this app to see distances.");
    } finally {
      setLocating(false);
    }
  };

  const all = [
    ...(data?.hospitals || []).map((row) => ({ ...row, kind: "hospital" })),
    ...(data?.organisations || []).map((row) => ({ ...row, kind: "organisation" })),
    ...(data?.camps || []).map((row) => ({ ...row, kind: "camp" })),
  ].filter((row) => row.location);
  const countOf = (id) => (id === "all" ? all.length : all.filter((row) => row.kind === id).length);
  const sorted = sortByDistance(
    all.filter((row) => filter === "all" || row.kind === filter),
    myPosition
  );

  const markers = sorted.map((row) => ({
    id: `${row.kind}-${row._id}`,
    lat: row.location.lat,
    lng: row.location.lng,
    kind: row.kind,
    title: nameOf(row),
    body: row.address,
  }));

  return (
    <div className="stack stack-tight">
      <LoadError error={error} hasData={!!data} onRetry={reload} />
      {!data && loading && (
        <>
          <div className="skel-block" style={{ height: MAP_HEIGHT, borderRadius: "var(--radius)" }} />
          <Loading rows={2} round />
        </>
      )}
      {data && (
        <div className="split">
          <div className="stack stack-tight map-column">
            <MapView
              center={myPosition ? [myPosition.lat, myPosition.lng] : DEFAULT_CENTER}
              zoom={myPosition ? 12 : DEFAULT_ZOOM}
              markers={markers}
              height={MAP_HEIGHT}
            />
            <button type="button" className="btn" onClick={useMyLocation} disabled={locating}>
              {locating ? (
                <span className="spinner" aria-hidden="true" />
              ) : (
                <Icon name="crosshair" size={20} />
              )}
              {locating ? "Locating…" : myPosition ? "Update my location" : "Use my location"}
            </button>
          </div>

          <div className="stack stack-tight">
            <div className="chips" role="group" aria-label="Show">
              {FILTERS.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  className="chip-btn"
                  aria-pressed={filter === option.id}
                  onClick={() => setFilter(option.id)}
                >
                  {option.label} {countOf(option.id)}
                </button>
              ))}
            </div>

            {sorted.length === 0 ? (
              <div className="group">
                <Empty icon="map" title={all.length === 0 ? "Nothing nearby yet" : "Nothing in this list"}>
                  {all.length === 0
                    ? "Hospitals, blood banks and camps appear here once they share their location."
                    : "Try a different filter."}
                </Empty>
              </div>
            ) : (
              <ul className="list group">
                {sorted.map((row) => {
                  const dist = myPosition ? fmtDistance(distanceKm(myPosition, row.location)) : null;
                  return (
                    <li className="row row-avatar" key={`${row.kind}-${row._id}`}>
                      <span className="avatar">
                        <Icon name={KIND_ICON[row.kind]} size={20} />
                      </span>
                      <div className="main">
                        <div className="title">{nameOf(row)}</div>
                        <div className="sub">{row.address || "No address"}</div>
                        <div className="sub strong">
                          {KIND_LABEL[row.kind]}
                          {dist && ` · ${dist} away`}
                        </div>
                      </div>
                      {row.phone && (
                        <a
                          className="icon-btn icon-btn-outline"
                          href={`tel:${row.phone}`}
                          aria-label={`Call ${nameOf(row)}`}
                        >
                          <Icon name="phone" size={20} />
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
