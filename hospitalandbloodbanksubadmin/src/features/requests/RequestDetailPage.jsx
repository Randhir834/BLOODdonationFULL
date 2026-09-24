import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ConfirmModal from "../../components/ConfirmModal";
import { LoadError, Notice, Spinner } from "../../components/Feedback";
import { NavIcon } from "../../components/Icons";
import { PriorityFlag, RequestState, StatusPill } from "../../components/Status";
import { useApi } from "../../hooks/useApi";
import { useRealtime } from "../../hooks/useRealtime";
import api, { errorMessage } from "../../lib/api";
import { REQUEST_COMPONENT_LABEL, RESPONSE_STATUS_LABEL, RELATION_LABEL, UNIT_ML } from "../../lib/constants";
import { fmtDate, fmtDateTime, fmtMl, formatPhone, nameOf } from "../../lib/format";
import { notify } from "../../lib/notify";
import NewRequestModal from "./NewRequestModal";
import OfferModal from "./OfferModal";
import RejectModal from "./RejectModal";

const RESPONSE_KIND = { pending: "warning", confirmed: "good", declined: "critical", withdrawn: "info" };
const TIMELINE_TONE = {
  fulfilled: "is-good",
  dispatched: "is-good",
  confirmed: "is-good",
  rejected: "is-bad",
  cancelled: "is-bad",
  declined: "is-bad",
};

/** How much blood the organisation has of the group asked for, against what is wanted. */
function StockCheck({ stock, units }) {
  const enough = stock.availableMl >= stock.neededMl;
  return (
    <div className={`stock-check ${enough ? "is-enough" : "is-short"}`}>
      <b>
        {fmtMl(stock.availableMl)} of {stock.bloodGroup}
      </b>{" "}
      in your stock.{" "}
      {enough
        ? `Enough for the ${fmtMl(stock.neededMl)} asked for.`
        : stock.availableMl >= UNIT_ML
          ? `Not the full ${fmtMl(stock.neededMl)}, but you can offer ${Math.floor(stock.availableMl / UNIT_ML)} of ${units} units.`
          : `Less than one unit (${fmtMl(UNIT_ML)}).`}
    </div>
  );
}

export default function RequestDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useApi(`/requests/${id}`);
  useRealtime("requests", reload);
  useRealtime("stock", reload);
  const [dialog, setDialog] = useState(null); // edit | offer | reject | fulfil | cancel | dispatch
  const [busy, setBusy] = useState(null);
  // Blood is issued from here: a second click before the first render commits must not fire a second call.
  const acting = useRef(false);

  if (!data) {
    return (
      <div className="stack">
        <Link className="back-link" to="/requests">
          <NavIcon name="arrowLeft" size={16} />
          All requests
        </Link>
        <LoadError message={error} hasData={false} onRetry={reload} />
        {!error && loading && <div className="card skeleton-card" aria-hidden="true" />}
      </div>
    );
  }

  const { request, myResponse, responses, stock, timeline } = data;
  const has = (action) => request.actions.includes(action);
  const mine = request.relation === "mine";
  const units = Math.max(1, request.unitsRequired || Math.round(request.quantity / UNIT_ML));

  const run = async (key, call, success, failure) => {
    if (acting.current) return false;
    acting.current = true;
    setBusy(key);
    try {
      await call();
      notify.success(success);
      await reload();
      return true;
    } catch (err) {
      notify.error(errorMessage(err, failure));
      return false;
    } finally {
      acting.current = false;
      setBusy(null);
      setDialog(null);
    }
  };

  const post = (path) => () => api.post(`/requests/${id}/${path}`);

  const requesterPhone = request.requester?.phone || request.requesterPhone;

  return (
    <div className="stack">
      <div>
        <Link className="back-link" to="/requests">
          <NavIcon name="arrowLeft" size={16} />
          All requests
        </Link>
        <div className="detail-head">
          <div>
            <h1>
              <span className="group-tag">{request.bloodGroup}</span>
              {fmtMl(request.quantity)} for {request.patientName}
            </h1>
            <div className="title-line" style={{ marginTop: "0.5rem" }}>
              <RequestState request={request} />
              <PriorityFlag priority={request.priority} />
              <span className="hint">{RELATION_LABEL[request.relation]}</span>
            </div>
          </div>
          <div className="page-actions">
            {has("respond") && (
              <button type="button" className="btn btn-primary" onClick={() => setDialog("offer")}>
                Respond
              </button>
            )}
            {has("fulfil") && (
              <button type="button" className="btn btn-primary" onClick={() => setDialog("fulfil")}>
                Issue from stock
              </button>
            )}
            {has("dispatch") && (
              <button type="button" className="btn btn-primary" onClick={() => setDialog("dispatch")}>
                Issue blood
              </button>
            )}
            {has("reject") && (
              <button type="button" className="btn" onClick={() => setDialog("reject")}>
                Reject
              </button>
            )}
            {has("withdraw") && (
              <button
                type="button"
                className="btn"
                disabled={busy !== null}
                onClick={() =>
                  run(
                    "withdraw",
                    () => api.post(`/requests/${id}/responses/${myResponse._id}/withdraw`),
                    "Offer withdrawn",
                    "Could not withdraw the offer"
                  )
                }
              >
                Withdraw offer
              </button>
            )}
            {has("edit") && (
              <button type="button" className="btn" onClick={() => setDialog("edit")}>
                Edit
              </button>
            )}
            {has("cancel") && (
              <button type="button" className="btn btn-danger-quiet" onClick={() => setDialog("cancel")}>
                Cancel request
              </button>
            )}
            {has("dismiss") && (
              <button
                type="button"
                className="btn"
                disabled={busy !== null}
                onClick={() =>
                  run("dismiss", post("dismiss"), "Hidden from your list", "Could not hide the request")
                }
              >
                Not for us
              </button>
            )}
            {has("restore") && (
              <button
                type="button"
                className="btn"
                disabled={busy !== null}
                onClick={() =>
                  run("restore", post("restore"), "Back in your list", "Could not restore the request")
                }
              >
                Show in my list
              </button>
            )}
          </div>
        </div>
      </div>

      <LoadError message={error} hasData onRetry={reload} />
      {request.actions.includes("dispatch") && (
        <Notice tone="info" title="Blood to issue">
          The requester confirmed your offer. Issue the blood from your stock when you are ready and they will
          be told.
        </Notice>
      )}
      {request.dismissed && <Notice tone="info">You hid this request from your list.</Notice>}

      <div className={`detail-grid ${loading ? "dim" : ""}`.trim()}>
        <div className="stack">
          <section className="card">
            <div className="card-head">
              <h2>Request</h2>
            </div>
            <dl className="kv">
              <dt>Patient</dt>
              <dd>{request.patientName}</dd>
              <dt>Blood needed</dt>
              <dd>
                {fmtMl(request.quantity)} of {request.bloodGroup},{" "}
                {REQUEST_COMPONENT_LABEL[request.component] || "whole blood"} (about {units} unit
                {units === 1 ? "" : "s"})
              </dd>
              <dt>Needed by</dt>
              <dd>{request.requiredAt ? fmtDateTime(request.requiredAt) : "As soon as possible"}</dd>
              <dt>Where</dt>
              <dd>{request.location}</dd>
              <dt>Contact</dt>
              <dd>
                {request.contactName || request.contactPhone ? (
                  <>
                    {request.contactName}
                    {request.contactPhone && (
                      <>
                        {request.contactName ? " · " : ""}
                        <a href={`tel:${request.contactPhone}`}>{request.contactPhone}</a>
                      </>
                    )}
                  </>
                ) : (
                  "-"
                )}
              </dd>
              <dt>Raised by</dt>
              <dd>
                {mine ? "You" : nameOf(request.requester)}
                {!mine && requesterPhone && (
                  <>
                    {" "}
                    · <a href={`tel:${requesterPhone}`}>{formatPhone(requesterPhone)}</a>
                  </>
                )}
                <div className="hint">
                  {request.city ? `${request.city} · ` : ""}
                  {fmtDateTime(request.createdAt)}
                </div>
              </dd>
              {request.note && (
                <>
                  <dt>Note</dt>
                  <dd>{request.note}</dd>
                </>
              )}
              {request.status === "rejected" && request.rejectionReason && (
                <>
                  <dt>Rejected because</dt>
                  <dd>{request.rejectionReason}</dd>
                </>
              )}
            </dl>
          </section>

          {mine && (
            <section className="card">
              <div className="card-head">
                <h2>Offers</h2>
                <div className="card-actions">
                  <span className="hint">
                    {request.unitsConfirmed || 0} of {units} unit{units === 1 ? "" : "s"} confirmed
                  </span>
                </div>
              </div>
              {responses.length === 0 ? (
                <p className="hint">No one has offered yet. Everyone in your city can see the request.</p>
              ) : (
                <ul className="offer-list">
                  {responses.map((response) => (
                    <li key={response._id}>
                      <div>
                        <div className="strong">{nameOf(response.responderId)}</div>
                        <div className="hint">
                          {response.unitsOffered} unit{response.unitsOffered === 1 ? "" : "s"} offered
                          {response.responderId?.phone && (
                            <>
                              {" "}
                              ·{" "}
                              <a href={`tel:${response.responderId.phone}`}>
                                {formatPhone(response.responderId.phone)}
                              </a>
                            </>
                          )}
                          {response.dispatchedAt &&
                            ` · ${fmtMl(response.dispatchedMl)} issued ${fmtDate(response.dispatchedAt)}`}
                        </div>
                      </div>
                      {response.status === "pending" && request.status === "pending" ? (
                        <div className="row-actions">
                          <button
                            type="button"
                            className="btn btn-small btn-primary"
                            disabled={busy !== null}
                            onClick={() =>
                              run(
                                `c${response._id}`,
                                () => api.post(`/requests/${id}/responses/${response._id}/confirm`),
                                "Offer confirmed",
                                "Could not confirm the offer"
                              )
                            }
                          >
                            {busy === `c${response._id}` && <Spinner />}
                            Confirm
                          </button>
                          <button
                            type="button"
                            className="btn btn-small"
                            disabled={busy !== null}
                            onClick={() =>
                              run(
                                `d${response._id}`,
                                () => api.post(`/requests/${id}/responses/${response._id}/decline`),
                                "Offer declined",
                                "Could not decline the offer"
                              )
                            }
                          >
                            Decline
                          </button>
                        </div>
                      ) : (
                        <StatusPill kind={RESPONSE_KIND[response.status] || "info"}>
                          {response.status === "confirmed" && response.unitsApplied
                            ? `Confirmed, ${response.unitsApplied} unit${response.unitsApplied === 1 ? "" : "s"}`
                            : RESPONSE_STATUS_LABEL[response.status]}
                        </StatusPill>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {!mine && myResponse && (
            <section className="card">
              <div className="card-head">
                <h2>Your offer</h2>
              </div>
              <div className="offer-list">
                <div className="title-line">
                  <StatusPill kind={RESPONSE_KIND[myResponse.status] || "info"}>
                    {RESPONSE_STATUS_LABEL[myResponse.status]}
                  </StatusPill>
                  <span>
                    {myResponse.unitsOffered} unit{myResponse.unitsOffered === 1 ? "" : "s"} offered
                    {myResponse.status === "confirmed" && myResponse.unitsApplied
                      ? `, ${myResponse.unitsApplied} confirmed`
                      : ""}
                  </span>
                </div>
                {myResponse.dispatchedAt && (
                  <p className="hint">
                    You issued {fmtMl(myResponse.dispatchedMl)} on {fmtDate(myResponse.dispatchedAt)}.
                  </p>
                )}
              </div>
            </section>
          )}
        </div>

        <div className="stack">
          {!mine && (
            <section className="card">
              <div className="card-head">
                <h2>Your stock</h2>
              </div>
              <StockCheck stock={stock} units={units} />
              <p className="detail-link">
                <Link to={`/stock?bloodGroup=${encodeURIComponent(request.bloodGroup)}&state=available`}>
                  See {request.bloodGroup} units
                </Link>
              </p>
            </section>
          )}
          <section className="card">
            <div className="card-head">
              <h2>Progress</h2>
            </div>
            <ol className="timeline">
              {timeline.map((entry, index) => (
                <li key={`${entry.at}-${index}`} className={TIMELINE_TONE[entry.kind] || ""}>
                  {entry.text}
                  <time dateTime={entry.at}>{fmtDateTime(entry.at)}</time>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      {dialog === "edit" && (
        <NewRequestModal
          request={request}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            reload();
          }}
        />
      )}
      {dialog === "offer" && (
        <OfferModal
          request={request}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            reload();
          }}
        />
      )}
      {dialog === "reject" && (
        <RejectModal
          request={request}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            reload();
          }}
        />
      )}
      {dialog === "fulfil" && (
        <ConfirmModal
          title="Issue this blood from your stock?"
          message={`${fmtMl(request.quantity)} of ${request.bloodGroup} is taken from your stock, first-expiring-first, and issued to ${nameOf(request.requester)}. The request is marked fulfilled.`}
          confirmLabel="Issue blood"
          onConfirm={() =>
            run("fulfil", post("fulfil"), "Blood issued, request fulfilled", "Could not issue the blood")
          }
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "dispatch" && (
        <ConfirmModal
          title="Issue the confirmed blood?"
          message={`${fmtMl((myResponse.unitsApplied ?? myResponse.unitsOffered) * UNIT_ML)} of ${request.bloodGroup} is taken from your stock, first-expiring-first, and issued to ${nameOf(request.requester)}.`}
          confirmLabel="Issue blood"
          onConfirm={() =>
            run(
              "dispatch",
              () => api.post(`/requests/${id}/responses/${myResponse._id}/dispatch`),
              "Blood issued",
              "Could not issue the blood"
            )
          }
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "cancel" && (
        <ConfirmModal
          title="Cancel this request?"
          message="Everyone who offered to help is told, and it is no longer shown in your city."
          confirmLabel="Cancel request"
          danger
          onConfirm={async () => {
            if (await run("cancel", post("cancel"), "Request cancelled", "Could not cancel the request"))
              navigate("/requests");
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
