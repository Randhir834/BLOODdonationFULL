import { useState } from "react";
import { Empty, LoadError, Spinner } from "../../components/Feedback";
import { StatusPill } from "../../components/Status";
import { useApi } from "../../hooks/useApi";
import { useRealtime } from "../../hooks/useRealtime";
import api, { errorMessage } from "../../lib/api";
import { fmtDateTime, fmtMl } from "../../lib/format";
import { notify } from "../../lib/notify";

/**
 * Hospitals: blood a blood bank issued to this hospital. It only counts as the hospital's stock once someone
 * confirms it arrived; confirming adds each unit with the expiry date the blood bank gave it.
 */
export default function DeliveriesTab({ onChanged }) {
  const { data, loading, error, reload } = useApi("/shipments");
  useRealtime("stock", reload);
  const [busyId, setBusyId] = useState(null);

  const receive = async (shipment) => {
    if (busyId) return;
    setBusyId(shipment._id);
    try {
      await api.post(`/shipments/${shipment._id}/receive`);
      notify.success(`${fmtMl(shipment.quantity)} of ${shipment.bloodGroup} added to your stock`);
      onChanged();
    } catch (err) {
      notify.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const shipments = data?.shipments ?? [];
  return (
    <section className="card">
      <div className="card-head">
        <h2>Blood issued to you</h2>
      </div>
      <p className="hint mb-16">
        Blood a blood bank issued to your hospital. Confirm it when it arrives and it is added to your stock.
      </p>
      <LoadError message={error} hasData={!!data} onRetry={reload} />
      {!data && loading && <div className="skeleton-card" aria-hidden="true" />}
      {data && shipments.length === 0 && (
        <Empty icon="truck" title="No deliveries yet" quiet>
          When a blood bank issues blood to your hospital it is listed here.
        </Empty>
      )}
      {shipments.length > 0 && (
        <div className={`table-wrap ${loading ? "dim" : ""}`.trim()}>
          <table className="cards">
            <thead>
              <tr>
                <th>Issued</th>
                <th>From</th>
                <th>Group</th>
                <th className="num">Amount</th>
                <th>Units</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shipments.map((shipment) => (
                <tr key={shipment._id}>
                  <td className="nowrap" data-label="Issued">
                    {fmtDateTime(shipment.createdAt)}
                  </td>
                  <td data-label="From">{shipment.from?.name || "Blood bank"}</td>
                  <td data-label="Group">
                    <span className="group-tag">{shipment.bloodGroup}</span>
                  </td>
                  <td className="num" data-label="Amount">
                    {fmtMl(shipment.quantity)}
                  </td>
                  <td data-label="Units">{shipment.units.length || "-"}</td>
                  <td data-label="Status">
                    {shipment.status === "received" ? (
                      <StatusPill kind="good">Received {fmtDateTime(shipment.receipt.receivedAt)}</StatusPill>
                    ) : (
                      <StatusPill kind="warning">Waiting for you</StatusPill>
                    )}
                  </td>
                  <td>
                    {shipment.status === "pending" && (
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-small btn-primary"
                          disabled={busyId !== null}
                          onClick={() => receive(shipment)}
                        >
                          {busyId === shipment._id && <Spinner />}
                          Confirm received
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
