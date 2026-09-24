import { useMemo, useState } from "react";
import ConfirmModal from "../../components/ConfirmModal";
import { Empty, LoadError, PageHead } from "../../components/Feedback";
import { TableSkeleton } from "../../components/Skeleton";
import { StatusPill } from "../../components/Status";
import { useToast } from "../../components/toastContext";
import { useApi } from "../../hooks/useApi";
import { useRealtime } from "../../hooks/useRealtime";
import { errorMessage } from "../../lib/api";
import { ROLE_LABEL } from "../../lib/constants";
import { fmtShort, nameOf } from "../../lib/format";
import MapView, { DEFAULT_CENTER, DEFAULT_ZOOM } from "./MapView";
import { reactivateCamp, removeCamp, suspendCamp } from "./locationsApi";

const KIND_LABEL = { ...ROLE_LABEL, camp: "Camp" };
const FILTERS = [
  { key: "donar", label: "Donors" },
  { key: "hospital", label: "Hospitals" },
  { key: "organisation", label: "Blood banks" },
  { key: "camp", label: "Camps" },
];

export default function LocationsPage() {
  const { data, loading, error, reload } = useApi("/locations");
  useRealtime(["locations", "camps"], reload);
  const toast = useToast();

  const [show, setShow] = useState({ donar: true, hospital: true, organisation: true, camp: true });
  const [confirming, setConfirming] = useState(null); // { action, camp } | null
  const [busyId, setBusyId] = useState(null);

  const rows = useMemo(() => {
    const people = (data?.people || []).map((person) => ({
      id: `user-${person._id}`,
      kind: person.role,
      name: nameOf(person),
      address: person.address,
      phone: person.phone,
      status: person.status,
      location: person.location,
      updatedAt: person.location?.updatedAt,
      camp: null,
    }));
    const camps = (data?.camps || []).map((camp) => ({
      id: `camp-${camp._id}`,
      kind: "camp",
      name: camp.name,
      address: camp.address,
      phone: null,
      status: camp.status,
      location: camp.location,
      updatedAt: camp.updatedAt,
      camp,
    }));
    return [...people, ...camps];
  }, [data]);

  const visible = rows.filter((row) => show[row.kind] && row.location);
  const markers = visible.map((row) => ({
    id: row.id,
    lat: row.location.lat,
    lng: row.location.lng,
    kind: row.kind,
    muted: row.status === "suspended",
    title: row.name,
    body: [KIND_LABEL[row.kind], row.address].filter(Boolean).join(" · "),
  }));

  const center = markers.length === 1 ? [markers[0].lat, markers[0].lng] : DEFAULT_CENTER;
  const zoom = markers.length === 1 ? 13 : DEFAULT_ZOOM;

  const runCampAction = async (action, camp) => {
    setBusyId(camp._id);
    try {
      if (action === "suspend") await suspendCamp(camp._id);
      if (action === "reactivate") await reactivateCamp(camp._id);
      if (action === "delete") await removeCamp(camp._id);
      if (action === "suspend") toast("Camp hidden");
      else if (action === "reactivate") toast("Camp reactivated");
      else toast("Camp deleted");
      setConfirming(null);
      reload();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="stack">
      <PageHead title="Locations">
        Every donor, hospital, blood bank and camp currently sharing its location.
      </PageHead>

      <section className="card">
        <LoadError message={error} hasData={!!data} onRetry={reload} />
        <div className="chip-row" role="group" aria-label="Show">
          {FILTERS.map((filter) => (
            <label key={filter.key} className="chip-toggle">
              <input
                type="checkbox"
                checked={show[filter.key]}
                onChange={(event) =>
                  setShow((current) => ({ ...current, [filter.key]: event.target.checked }))
                }
              />
              {filter.label} ({rows.filter((row) => row.kind === filter.key).length})
            </label>
          ))}
        </div>

        {!data && loading ? (
          <div className="map-frame" style={{ height: 460 }} />
        ) : (
          <MapView center={center} zoom={zoom} markers={markers} />
        )}
        {data && visible.length === 0 && <Empty icon="map">Nothing to show for these filters yet.</Empty>}
      </section>

      <section className="card">
        <div className={`table-wrap ${loading ? "dim" : ""}`.trim()}>
          <table className="cards">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Address</th>
                <th>Status</th>
                <th>Last updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {!data && loading && <TableSkeleton columns={6} />}
              {rows.map((row) => (
                <tr key={row.id}>
                  <td data-label="Name">
                    {row.name}
                    {row.phone && <div className="sub">{row.phone}</div>}
                  </td>
                  <td data-label="Type">{KIND_LABEL[row.kind]}</td>
                  <td data-label="Address">{row.address || "-"}</td>
                  <td data-label="Status">
                    {row.status === "suspended" ? (
                      <StatusPill kind="critical">{row.kind === "camp" ? "Hidden" : "Suspended"}</StatusPill>
                    ) : (
                      <StatusPill kind="good">Active</StatusPill>
                    )}
                  </td>
                  <td data-label="Last updated">{fmtShort(row.updatedAt)}</td>
                  <td>
                    {row.camp && (
                      <div className="row-actions">
                        {row.camp.status === "active" ? (
                          <button
                            type="button"
                            className="btn btn-small"
                            disabled={busyId === row.camp._id}
                            onClick={() => setConfirming({ action: "suspend", camp: row.camp })}
                          >
                            Hide
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-small"
                            disabled={busyId === row.camp._id}
                            onClick={() => runCampAction("reactivate", row.camp)}
                          >
                            Reactivate
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-small btn-danger-quiet"
                          disabled={busyId === row.camp._id}
                          onClick={() => setConfirming({ action: "delete", camp: row.camp })}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && rows.length === 0 && <Empty icon="map">No one is sharing their location yet.</Empty>}
        </div>
      </section>

      {confirming && (
        <ConfirmModal
          title={confirming.action === "delete" ? "Delete this camp?" : "Hide this camp?"}
          message={
            confirming.action === "delete"
              ? `${confirming.camp.name} will be permanently removed.`
              : `${confirming.camp.name} will no longer appear on anyone's map until reactivated.`
          }
          confirmLabel={confirming.action === "delete" ? "Delete" : "Hide"}
          danger={confirming.action === "delete"}
          onConfirm={() => runCampAction(confirming.action, confirming.camp)}
          onClose={() => setConfirming(null)}
        />
      )}
    </div>
  );
}
