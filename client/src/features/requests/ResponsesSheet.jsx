import { useState } from "react";
import Modal from "../../components/Modal";
import { SheetBody, SheetHeader } from "../../components/Sheet";
import Spinner from "../../components/Spinner";
import { Empty, ErrorBanner, Loading } from "../../components/States";
import { useLoad } from "../../hooks/useLoad";
import { errorMessage } from "../../lib/api";
import { RESPONSE_STATUS_LABEL, ROLE_LABEL } from "../../lib/constants";
import { fmtAgo, fmtNum, formatPhone, initialOf, nameOf } from "../../lib/format";
import { confirmResponse, declineResponse, listResponses } from "./requestsApi";

const STATUS_CHIP = { confirmed: "chip-success", declined: "chip-danger" };

/** The requester: every response their request has received, with Confirm/Decline on the pending ones. */
export default function ResponsesSheet({ request, onClose, onDone }) {
  const { data, loading, error, reload } = useLoad(() => listResponses(request._id), [request._id]);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState("");

  // The row shows the result at once (a Confirmed or Declined label), so there is no message on top of it.
  const decide = async (response, action, failure) => {
    setBusyId(response._id);
    setActionError("");
    try {
      await action(request._id, response._id);
      reload();
      onDone();
    } catch (err) {
      setActionError(errorMessage(err, failure));
    } finally {
      setBusyId(null);
    }
  };

  const confirm = (response) => decide(response, confirmResponse, "Could not confirm this response.");

  const decline = (response) => decide(response, declineResponse, "Could not decline this response.");

  return (
    <Modal labelledBy="responses-title" onClose={onClose}>
      <SheetHeader
        id="responses-title"
        title="Responses"
        subtitle={`${request.quantity} ML ${request.bloodGroup} for ${request.patientName}`}
        onClose={onClose}
      />
      <SheetBody>
        <ErrorBanner message={error || actionError} onRetry={error ? reload : undefined} className="mb-16" />
        {!data && loading && <Loading rows={2} round />}
        {data && data.length === 0 && (
          <div className="group">
            <Empty icon="users" title="No responses yet" quiet>
              Once someone nearby offers units, they will show up here.
            </Empty>
          </div>
        )}
        {data && data.length > 0 && (
          <ul className="list group">
            {data.map((response) => (
              <li className="row row-avatar" key={response._id}>
                <span className="avatar">{initialOf(response.responderId)}</span>
                <div className="main">
                  <div className="title-line">
                    <div className="title">{nameOf(response.responderId)}</div>
                    {response.status !== "pending" && (
                      <span className={`chip ${STATUS_CHIP[response.status] || ""}`.trim()}>
                        {RESPONSE_STATUS_LABEL[response.status]}
                      </span>
                    )}
                  </div>
                  <div className="sub strong">
                    {fmtNum(response.unitsOffered)} unit(s) offered · {fmtAgo(response.createdAt)}
                  </div>
                  <div className="sub">
                    {ROLE_LABEL[response.responderRole]} · {formatPhone(response.responderPhone)}
                  </div>
                </div>
                {response.status === "pending" && (
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      disabled={busyId === response._id}
                      onClick={() => confirm(response)}
                    >
                      {busyId === response._id && <Spinner />}
                      Confirm
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={busyId === response._id}
                      onClick={() => decline(response)}
                    >
                      Decline
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </SheetBody>
    </Modal>
  );
}
