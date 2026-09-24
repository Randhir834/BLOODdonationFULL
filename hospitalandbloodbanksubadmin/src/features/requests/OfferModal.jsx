import { useRef, useState } from "react";
import { TextField } from "../../components/Fields";
import { LoadError, Notice, Spinner } from "../../components/Feedback";
import Modal from "../../components/Modal";
import { useApi } from "../../hooks/useApi";
import api, { errorMessage } from "../../lib/api";
import { UNIT_ML } from "../../lib/constants";
import { fmtMl } from "../../lib/format";
import { notify } from "../../lib/notify";

/**
 * "We can help": offers a number of units (one unit is 450 ML) from the organisation's own stock. It is checked
 * against what is in stock, so nobody promises blood they do not have. The requester then confirms or declines.
 */
export default function OfferModal({ request, onClose, onDone }) {
  const { data, error, reload } = useApi(`/requests/${request._id}`);
  const [units, setUnits] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  const available = data?.stock.availableMl;
  const canOffer = available === undefined ? undefined : Math.floor(available / UNIT_ML);
  const wanted = Math.max(1, Math.round(request.quantity / UNIT_ML));

  const submit = async (event) => {
    event.preventDefault();
    if (submitting.current || available === undefined) return;
    const count = Number(units);
    if (!Number.isInteger(count) || count <= 0)
      return setFieldError("Enter how many units you can give, as a whole number.");
    if (count > canOffer)
      return setFieldError(
        `You have ${fmtMl(available)}, enough for ${canOffer} unit${canOffer === 1 ? "" : "s"}.`
      );
    setFieldError("");
    setFormError("");

    submitting.current = true;
    setBusy(true);
    try {
      await api.post(`/requests/${request._id}/offer`, { unitsOffered: count });
      notify.success("Offer sent to the requester");
      onDone();
    } catch (err) {
      setFormError(errorMessage(err, "Could not send the offer. Please try again."));
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Offer blood"
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="submit"
            form="offer-form"
            className="btn btn-primary"
            disabled={busy || available === undefined || canOffer < 1}
          >
            {busy && <Spinner />}
            Send offer
          </button>
        </>
      }
    >
      <form id="offer-form" onSubmit={submit} noValidate>
        <p>
          {fmtMl(request.quantity)} of {request.bloodGroup} for {request.patientName}, about {wanted} unit
          {wanted === 1 ? "" : "s"}. The requester chooses which offers to confirm.
        </p>
        <LoadError message={error} hasData={false} onRetry={reload} />
        {data && (
          <>
            {canOffer < 1 ? (
              <Notice tone="warning" className="form-note">
                You have {fmtMl(available)} of {request.bloodGroup} in stock, not enough for one unit (
                {fmtMl(UNIT_ML)}).
              </Notice>
            ) : (
              <p className="hint" role="status">
                You have {fmtMl(available)} of {request.bloodGroup}, enough for {canOffer} unit
                {canOffer === 1 ? "" : "s"}.
              </p>
            )}
            {formError && (
              <Notice className="form-note" role="alert">
                {formError}
              </Notice>
            )}
            <TextField
              label="Units you can give"
              value={units}
              onChange={(value) => {
                setUnits(value.replace(/\D/g, "").slice(0, 2));
                setFieldError("");
              }}
              error={fieldError}
              inputMode="numeric"
              disabled={canOffer < 1}
            />
          </>
        )}
      </form>
    </Modal>
  );
}
