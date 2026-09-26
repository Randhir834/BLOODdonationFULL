import { useState } from "react";
import { Icon } from "../../components/Icon";
import Modal from "../../components/Modal";
import { SheetBody, SheetFooter, SheetHeader } from "../../components/Sheet";
import Spinner from "../../components/Spinner";
import { ErrorBanner, Loading, Notice } from "../../components/States";
import { useLoad } from "../../hooks/useLoad";
import { errorMessage } from "../../lib/api";
import { REQUEST_COMPONENT_LABEL, REQUEST_PRIORITY_LABEL, RESPONSE_STATUS_LABEL } from "../../lib/constants";
import { fmtDate, fmtNum, formatPhone, nameOf } from "../../lib/format";
import { notify } from "../../lib/notify";
import { getRequest, respondToRequest, withdrawResponse } from "./requestsApi";

const MAX_UNITS = 20;

/** Any role: reviews one nearby request in full, and offers (or withdraws) units against it. */
export default function RespondSheet({ request, onClose, onDone }) {
  const { data, loading, error, reload } = useLoad(() => getRequest(request._id), [request._id]);
  const [units, setUnits] = useState(1);
  const [unitsError, setUnitsError] = useState("");
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);

  const detail = data?.request;
  const myResponse = data?.myResponse;
  const offering = detail && detail.status === "pending" && !myResponse;

  const step = (change) => {
    setUnits((current) => Math.min(MAX_UNITS, Math.max(1, (Number(current) || 0) + change)));
    setUnitsError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!offering) return;
    if (!Number.isInteger(units) || units < 1 || units > MAX_UNITS) {
      setUnitsError(`Enter a whole number of units, up to ${MAX_UNITS}.`);
      return;
    }
    setUnitsError("");
    setServerError("");
    setBusy(true);
    try {
      await respondToRequest(request._id, units);
      notify.success("Offer sent");
      onDone();
    } catch (err) {
      setServerError(errorMessage(err, "Could not send your offer. Please try again."));
      setBusy(false);
    }
  };

  const withdraw = async () => {
    setServerError("");
    setBusy(true);
    try {
      await withdrawResponse(request._id, myResponse._id);
      notify.success("Offer withdrawn");
      onDone();
    } catch (err) {
      setServerError(errorMessage(err, "Could not withdraw your offer. Please try again."));
      setBusy(false);
    }
  };

  const rows = detail
    ? [
        ["Patient", detail.patientName],
        ["Component", REQUEST_COMPONENT_LABEL[detail.component]],
        ["Urgency", REQUEST_PRIORITY_LABEL[detail.priority]],
        detail.requiredAt && ["Needed by", fmtDate(detail.requiredAt)],
        ["Location", detail.location],
        ["Raised by", nameOf(detail.requester)],
        (detail.contactName || detail.contactPhone) && [
          "Contact",
          [detail.contactName, detail.contactPhone && formatPhone(detail.contactPhone)]
            .filter(Boolean)
            .join(" · "),
        ],
        detail.note && ["Note", detail.note],
        [
          "Units still needed",
          `${fmtNum(Math.max(0, detail.unitsRequired - detail.unitsConfirmed))} of ${fmtNum(detail.unitsRequired)}`,
        ],
      ].filter(Boolean)
    : [];

  return (
    <Modal as="form" labelledBy="respond-title" onClose={onClose} onSubmit={submit} noValidate>
      <SheetHeader
        id="respond-title"
        title={`${request.quantity} ML ${request.bloodGroup}`}
        subtitle="Someone nearby needs blood."
        onClose={onClose}
      />
      <SheetBody>
        <ErrorBanner message={error || serverError} onRetry={error ? reload : undefined} className="mb-16" />
        {!detail && loading && <Loading rows={2} round />}

        {detail && (
          <div className="group mb-16">
            {rows.map(([label, value]) => (
              <div className="kv kv-plain" key={label}>
                <div className="k">{label}</div>
                <div className="v">{value}</div>
              </div>
            ))}
          </div>
        )}

        {detail && detail.status !== "pending" && (
          <Notice tone="info" role="status">
            This request is no longer open.
          </Notice>
        )}

        {detail && detail.status === "pending" && myResponse && (
          <Notice tone="success" title="You have offered to help" role="status">
            {fmtNum(myResponse.unitsOffered)} unit(s) · {RESPONSE_STATUS_LABEL[myResponse.status]}
          </Notice>
        )}

        {offering && (
          <div className="field">
            <label className="field-label" htmlFor="units-offered">
              Units you can give
            </label>
            <div className="stepper">
              <button
                type="button"
                className="icon-btn icon-btn-outline"
                aria-label="One unit fewer"
                disabled={units <= 1}
                onClick={() => step(-1)}
              >
                <span className="stepper-glyph" aria-hidden="true">
                  −
                </span>
              </button>
              <input
                id="units-offered"
                className={`input num ${unitsError ? "invalid" : ""}`}
                type="number"
                inputMode="numeric"
                min="1"
                max={MAX_UNITS}
                step="1"
                value={units}
                aria-invalid={!!unitsError}
                onChange={(event) => {
                  setUnits(Number(event.target.value));
                  setUnitsError("");
                }}
              />
              <button
                type="button"
                className="icon-btn icon-btn-outline"
                aria-label="One unit more"
                disabled={units >= MAX_UNITS}
                onClick={() => step(1)}
              >
                <Icon name="plus" size={20} />
              </button>
            </div>
            {unitsError && <div className="field-error">{unitsError}</div>}
          </div>
        )}
      </SheetBody>

      {offering && (
        <SheetFooter>
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy && <Spinner />}
            {busy ? "Sending" : "Offer to help"}
          </button>
        </SheetFooter>
      )}
      {detail && detail.status === "pending" && myResponse?.status === "pending" && (
        <SheetFooter>
          <button type="button" className="btn btn-block" disabled={busy} onClick={withdraw}>
            {busy && <Spinner />}
            Withdraw offer
          </button>
        </SheetFooter>
      )}
    </Modal>
  );
}
