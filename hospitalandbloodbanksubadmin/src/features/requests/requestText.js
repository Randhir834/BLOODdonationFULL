import { RELATION_LABEL, RESPONSE_STATUS_LABEL } from "../../lib/constants";

/** What this organisation has done about a request, in a few words. */
export const yourPart = (request) => {
  const { relation, myResponse } = request;
  if (relation === "mine") {
    if (request.pendingResponses > 0)
      return `${request.pendingResponses} offer${request.pendingResponses === 1 ? "" : "s"} to review`;
    return request.unitsConfirmed > 0
      ? `${request.unitsConfirmed} of ${request.unitsRequired} units confirmed`
      : RELATION_LABEL.mine;
  }
  if (myResponse) {
    if (myResponse.dispatchedRecordId) return "You issued the blood";
    if (myResponse.status === "confirmed") return "Your offer was confirmed";
    return `Your offer: ${RESPONSE_STATUS_LABEL[myResponse.status].toLowerCase()}`;
  }
  return RELATION_LABEL[relation];
};
