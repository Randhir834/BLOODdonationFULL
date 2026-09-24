import { getDb } from "../config/firebase.js";
import { REQUEST_STATUS, RESPONSE_STATUS } from "../constants/index.js";
import { HttpError } from "../utils/HttpError.js";
import { requestResponsesCollection, requestsCollection } from "./collections.js";

const toResponse = (doc) => ({ _id: doc.id, ...doc.data() });
const newestFirst = (a, b) => (a.createdAt < b.createdAt ? 1 : -1);
const isDocId = (id) => typeof id === "string" && id.length > 0 && !id.includes("/");

export const findResponseById = async (id) => {
  if (!isDocId(id)) return null;
  const doc = await requestResponsesCollection().doc(id).get();
  return doc.exists ? toResponse(doc) : null;
};

/** Every response to one request, newest first. Used both by its own requester and by admin. */
export const listResponsesForRequest = async (requestId) => {
  const snap = await requestResponsesCollection().where("requestId", "==", requestId).get();
  return snap.docs.map(toResponse).sort(newestFirst);
};

/**
 * The signed-in user's own, most recent response to one request (or null), so a non-owner viewing a
 * request they were notified about can be shown their own offer's status without seeing anyone else's.
 */
export const findOwnResponse = async (requestId, responderId) => {
  const snap = await requestResponsesCollection()
    .where("requestId", "==", requestId)
    .where("responderId", "==", responderId)
    .get();
  return snap.docs.map(toResponse).sort(newestFirst)[0] || null;
};

/**
 * A donor, hospital or blood bank offers some number of units against a pending request that is not
 * their own. Only one open (pending or confirmed) response per responder per request is allowed.
 */
export const createResponse = async (request, responder, unitsOffered) => {
  if (request.status !== REQUEST_STATUS.PENDING) {
    throw new HttpError(400, `This request is already ${request.status}`);
  }
  if (request.requester === responder._id) throw new HttpError(400, "You can not respond to your own request");

  const existing = await requestResponsesCollection()
    .where("requestId", "==", request._id)
    .where("responderId", "==", responder._id)
    .where("status", "in", [RESPONSE_STATUS.PENDING, RESPONSE_STATUS.CONFIRMED])
    .limit(1)
    .get();
  if (!existing.empty) throw new HttpError(409, "You have already responded to this request");

  const now = new Date().toISOString();
  const record = {
    requestId: request._id,
    responderId: responder._id,
    responderRole: responder.role,
    responderPhone: responder.phone,
    unitsOffered,
    status: RESPONSE_STATUS.PENDING,
    createdAt: now,
    updatedAt: now,
  };
  const ref = await requestResponsesCollection().add(record);

  return { _id: ref.id, ...record };
};

const requireOwnOpenResponse = (response, requesterField, actorId, status = RESPONSE_STATUS.PENDING) => {
  if (!response || response[requesterField] !== actorId) throw new HttpError(404, "Response not found");
  if (response.status !== status) throw new HttpError(400, `This response is already ${response.status}`);
};

/**
 * The requester accepts one of their request's pending responses. Adds at most the request's still
 * remaining units (never overshooting what was asked for) to its running confirmed total, and marks the
 * whole request fulfilled once that total meets what was required — the same terminal state a blood
 * bank issuing the blood directly would reach, whichever path gets there first.
 */
export const confirmResponse = async (request, response, requesterId) => {
  if (request.requester !== requesterId) throw new HttpError(404, "Request not found");
  requireOwnOpenResponse(response, "requestId", request._id);

  const now = new Date().toISOString();
  const result = await getDb().runTransaction(async (tx) => {
    const requestRef = requestsCollection().doc(request._id);
    const responseRef = requestResponsesCollection().doc(response._id);
    const [freshRequestDoc, freshResponseDoc] = await Promise.all([tx.get(requestRef), tx.get(responseRef)]);
    const freshRequest = { _id: freshRequestDoc.id, ...freshRequestDoc.data() };
    const freshResponse = { _id: freshResponseDoc.id, ...freshResponseDoc.data() };

    if (freshRequest.status !== REQUEST_STATUS.PENDING) {
      throw new HttpError(400, `This request is already ${freshRequest.status}`);
    }
    if (freshResponse.status !== RESPONSE_STATUS.PENDING) {
      throw new HttpError(400, `This response is already ${freshResponse.status}`);
    }

    const remaining = freshRequest.unitsRequired - freshRequest.unitsConfirmed;
    const unitsApplied = Math.min(freshResponse.unitsOffered, remaining);
    const unitsConfirmed = freshRequest.unitsConfirmed + unitsApplied;
    const fulfilled = unitsConfirmed >= freshRequest.unitsRequired;

    tx.update(responseRef, { status: RESPONSE_STATUS.CONFIRMED, unitsApplied, updatedAt: now });
    tx.update(requestRef, {
      unitsConfirmed,
      status: fulfilled ? REQUEST_STATUS.FULFILLED : REQUEST_STATUS.PENDING,
      updatedAt: now,
    });
    return {
      request: { ...freshRequest, unitsConfirmed, status: fulfilled ? REQUEST_STATUS.FULFILLED : freshRequest.status },
      response: { ...freshResponse, status: RESPONSE_STATUS.CONFIRMED, unitsApplied },
      fulfilled,
    };
  });

  if (result.fulfilled) {
    await autoDeclineRemaining(request._id, response._id);
  }

  return result;
};

/** Once a request is fully matched, every other still-pending response is turned down automatically. */
const autoDeclineRemaining = async (requestId, excludeResponseId) => {
  const snap = await requestResponsesCollection()
    .where("requestId", "==", requestId)
    .where("status", "==", RESPONSE_STATUS.PENDING)
    .get();
  const now = new Date().toISOString();
  for (const doc of snap.docs) {
    if (doc.id === excludeResponseId) continue;
    await doc.ref.update({ status: RESPONSE_STATUS.DECLINED, updatedAt: now });
  }
};

/** The requester turns down one of their request's pending responses. */
export const declineResponse = async (request, response, requesterId) => {
  if (request.requester !== requesterId) throw new HttpError(404, "Request not found");
  requireOwnOpenResponse(response, "requestId", request._id);

  const now = new Date().toISOString();
  await requestResponsesCollection()
    .doc(response._id)
    .update({ status: RESPONSE_STATUS.DECLINED, updatedAt: now });
  return { ...response, status: RESPONSE_STATUS.DECLINED, updatedAt: now };
};

/** The responder withdraws their own still-pending offer. */
export const withdrawResponse = async (response, responderId) => {
  requireOwnOpenResponse(response, "responderId", responderId);
  const now = new Date().toISOString();
  await requestResponsesCollection()
    .doc(response._id)
    .update({ status: RESPONSE_STATUS.WITHDRAWN, updatedAt: now });
  return { ...response, status: RESPONSE_STATUS.WITHDRAWN, updatedAt: now };
};

/** Every still-pending responder's offer is declined when a request is cancelled. */
export const handleCancelledRequest = async (request) => {
  const snap = await requestResponsesCollection()
    .where("requestId", "==", request._id)
    .where("status", "==", RESPONSE_STATUS.PENDING)
    .get();
  const now = new Date().toISOString();
  for (const doc of snap.docs) {
    await doc.ref.update({ status: RESPONSE_STATUS.DECLINED, updatedAt: now });
  }
};
