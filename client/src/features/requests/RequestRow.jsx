import Spinner from "../../components/Spinner";
import { REQUEST_COMPONENT_LABEL, REQUEST_PRIORITY_LABEL, REQUEST_STATUS_LABEL } from "../../lib/constants";
import { fmtAgo, fmtDate, fmtNum, nameOf } from "../../lib/format";

const STATUS_CHIP = { fulfilled: "chip-success", rejected: "chip-danger" };
const PRIORITY_CHIP = { emergency: "chip-emergency", urgent: "chip-urgent" };

/**
 * One blood request. `party` is the other side of it: the target blood bank, for a requester's own
 * list (often null now, since a request no longer has to name one), or the requester, for a "nearby" or
 * "incoming" list. `partyLabel` says which ("To"/"From"). The action buttons shown depend on which
 * handlers are passed and whether the request is still pending; `onViewResponses` is shown regardless.
 */
export default function RequestRow({
  request,
  party,
  partyLabel,
  onFulfil,
  onReject,
  onCancel,
  onEdit,
  onRespond,
  onViewResponses,
  busy = false,
}) {
  const pending = request.status === "pending";
  const expired = pending && request.requiredAt && request.requiredAt < new Date().toISOString();
  const hasActions =
    (pending && (onFulfil || onRespond || onReject || onEdit || onCancel)) || onViewResponses;

  // One chip says what matters most: how the request ended, or else how urgent it still is.
  let chip = null;
  if (expired) chip = { label: "Expired", tone: "" };
  else if (!pending)
    chip = { label: REQUEST_STATUS_LABEL[request.status], tone: STATUS_CHIP[request.status] || "" };
  else if (request.priority !== "normal") {
    chip = { label: REQUEST_PRIORITY_LABEL[request.priority], tone: PRIORITY_CHIP[request.priority] || "" };
  }

  const detail = [
    `${fmtNum(request.quantity)} ML`,
    request.component && request.component !== "whole_blood" && REQUEST_COMPONENT_LABEL[request.component],
    fmtAgo(request.createdAt),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="row row-tagged">
      <span className="tag">{request.bloodGroup}</span>
      <div className="main">
        <div className="title-line">
          <div className="title">{request.patientName}</div>
          {chip && <span className={`chip ${chip.tone}`.trim()}>{chip.label}</span>}
        </div>
        <div className="sub strong">{detail}</div>
        <div className="sub">{request.location}</div>
        {party ? (
          <div className="sub">
            {partyLabel} {nameOf(party)}
          </div>
        ) : (
          request.city && <div className="sub">Visible in {request.city}</div>
        )}
        {request.requiredAt && pending && <div className="sub">Needed by {fmtDate(request.requiredAt)}</div>}
        {request.note && <div className="sub">{request.note}</div>}
        {request.status === "rejected" && request.rejectionReason && (
          <div className="sub">Reason: {request.rejectionReason}</div>
        )}
      </div>
      {hasActions && (
        <div className="row-actions">
          {pending && onFulfil && (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={busy}
              onClick={() => onFulfil(request)}
            >
              {busy && <Spinner />}
              Fulfil
            </button>
          )}
          {pending && onRespond && (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={busy}
              onClick={() => onRespond(request)}
            >
              Respond
            </button>
          )}
          {pending && onReject && (
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => onReject(request)}>
              Reject
            </button>
          )}
          {onViewResponses && (
            <button
              type="button"
              className="btn btn-sm"
              disabled={busy}
              onClick={() => onViewResponses(request)}
            >
              Responses
            </button>
          )}
          {pending && onEdit && (
            <button
              type="button"
              className="link-btn link-btn-sm"
              disabled={busy}
              onClick={() => onEdit(request)}
            >
              Edit
            </button>
          )}
          {pending && onCancel && (
            <button
              type="button"
              className="link-btn link-btn-sm"
              disabled={busy}
              onClick={() => onCancel(request)}
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </li>
  );
}
