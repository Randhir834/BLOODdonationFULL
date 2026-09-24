import { getDb } from "../config/firebase.js";
import { LIMITS, REQUEST_STATUS, ROLES, STANDARD_UNIT_ML } from "../constants/index.js";
import { HttpError } from "../utils/HttpError.js";
import { requestsCollection } from "./collections.js";
import { recordBlood } from "./inventoryService.js";
import { findUserById, isApproved } from "./userService.js";

const toRequest = (doc) => ({ _id: doc.id, ...doc.data() });
const newestFirst = (a, b) => (a.createdAt < b.createdAt ? 1 : -1);
const isDocId = (id) => typeof id === "string" && id.length > 0 && !id.includes("/");

/** The blood bank a request asks: must exist, be a blood bank, be approved, and not be the requester itself. */
const requireValidBank = async (organisationId, requesterId) => {
  if (organisationId === requesterId) throw new HttpError(400, "Choose a different blood bank");
  const bank = await findUserById(organisationId);
  if (!bank || bank.role !== ROLES.ORGANISATION) throw new HttpError(404, "Blood bank not found");
  if (!isApproved(bank)) throw new HttpError(409, "This blood bank has not been approved yet");
};

const requestFields = (body) => ({
  organisation: body.organisation || null,
  patientName: body.patientName,
  bloodGroup: body.bloodGroup,
  component: body.component,
  quantity: body.quantity,
  priority: body.priority,
  requiredAt: body.requiredAt ? new Date(body.requiredAt).toISOString() : null,
  location: body.location,
  contactName: body.contactName,
  contactPhone: body.contactPhone,
  note: body.note,
});

/**
 * Any signed-in donor, hospital or blood bank can raise a request, for themselves or on someone else's
 * behalf (the patient/recipient is named separately, on the request). It is not targeted at any one
 * blood bank: it broadcasts to the requester's own city, so every other relevant active user there
 * (`listNearbyRequests`) can see and respond to it from their own Request page. An `organisation` may
 * still be supplied for back-compat, in which case that blood bank alone also sees it as "incoming" and
 * can fulfil/reject it directly (`fulfilRequest`/`rejectRequest`), the same as before this existed.
 *
 * Two independent paths can each fully satisfy the request: a named blood bank (if any) can issue it
 * from stock (`fulfilRequest`), or enough individual donors, hospitals or blood banks can respond and be
 * confirmed (see responseService) that `unitsConfirmed` reaches `unitsRequired`. `unitsRequired` is only
 * a rough donor headcount derived from the ML amount, since stock itself is never tracked in units.
 * `geo` is only ever set when the requester already shares their live location elsewhere in the app
 * (never a new prompt just for this), so eligibility matching can prefer nearby donors when it can.
 */
export const createRequest = async (requester, body) => {
  if (body.organisation) await requireValidBank(body.organisation, requester._id);

  const now = new Date().toISOString();
  const record = {
    requester: requester._id,
    requesterRole: requester.role,
    // The phone the request is fulfilled against, the same way every other issue is: never editable,
    // so it is safe to keep here rather than looking the requester up again when it is fulfilled.
    requesterPhone: requester.phone,
    // Fixed to the requester's city at creation time, the same way requesterPhone is: editing your
    // profile's city afterward must not move an already-open request into a different city's feed.
    city: requester.city || null,
    cityKey: requester.cityKey || null,
    ...requestFields(body),
    unitsRequired: Math.max(1, Math.round(body.quantity / STANDARD_UNIT_ML)),
    unitsConfirmed: 0,
    geo: requester.locationSharing && requester.location ? { lat: requester.location.lat, lng: requester.location.lng } : null,
    status: REQUEST_STATUS.PENDING,
    createdAt: now,
    updatedAt: now,
  };
  const ref = await requestsCollection().add(record);
  return { _id: ref.id, ...record };
};

export const findRequestById = async (id) => {
  if (!isDocId(id)) return null;
  const doc = await requestsCollection().doc(id).get();
  return doc.exists ? toRequest(doc) : null;
};

/** Every request naming this blood bank or made by this requester, newest first, optionally by status. */
export const listRequests = async (field, id, status) => {
  let query = requestsCollection().where(field, "==", id);
  if (status) query = query.where("status", "==", status);
  const snap = await query.get();
  return snap.docs.map(toRequest).sort(newestFirst);
};

/**
 * The discovery feed: every other pending request from the signed-in user's own city, newest first,
 * excluding the viewer's own (those already show under "my requests"). A viewer with no city set yet
 * (an account created before `city` existed, who has not used the profile-edit screen) gets an empty
 * list rather than an error.
 */
export const listNearbyRequests = async (cityKey, viewerId, status = REQUEST_STATUS.PENDING) => {
  if (!cityKey) return [];
  let query = requestsCollection().where("cityKey", "==", cityKey);
  if (status) query = query.where("status", "==", status);
  const snap = await query.get();
  return snap.docs
    .map(toRequest)
    .filter((request) => request.requester !== viewerId)
    .sort(newestFirst);
};

const requireOwnPendingRequest = (request, field, actorId) => {
  if (!request || request[field] !== actorId) throw new HttpError(404, "Request not found");
  if (request.status !== REQUEST_STATUS.PENDING) {
    throw new HttpError(400, `This request is already ${request.status}`);
  }
};

/**
 * The requester: edits their own request while it is still pending. A field left out of `body` keeps
 * its current value, the same way an admin's user edit does, so the person only has to send what they
 * actually changed. Re-reads and re-checks inside a transaction, the same way fulfilling/rejecting/
 * cancelling do, so an edit can not land on a request that a blood bank has just fulfilled or rejected.
 */
export const editRequest = async (request, requester, body) => {
  requireOwnPendingRequest(request, "requester", requester._id);
  const now = new Date().toISOString();

  return getDb().runTransaction(async (tx) => {
    const ref = requestsCollection().doc(request._id);
    const fresh = toRequest(await tx.get(ref));
    requireOwnPendingRequest(fresh, "requester", requester._id);

    const update = {
      // The blood group, component and priority always arrive as a real choice, never omitted. The
      // target blood bank (if any) and the broadcast city are fixed at creation, not editable here.
      bloodGroup: body.bloodGroup,
      component: body.component,
      priority: body.priority,
      patientName: body.patientName ?? fresh.patientName,
      quantity: body.quantity ?? fresh.quantity,
      requiredAt: body.requiredAt ? new Date(body.requiredAt).toISOString() : (fresh.requiredAt ?? null),
      location: body.location ?? fresh.location,
      contactName: body.contactName ?? fresh.contactName,
      contactPhone: body.contactPhone ?? fresh.contactPhone,
      note: body.note ?? fresh.note,
      updatedAt: now,
    };
    tx.update(ref, update);
    return { ...fresh, ...update };
  });
};

/**
 * Blood bank: fulfils a pending request by issuing the blood right now (FEFO, same as recording an
 * ordinary issue). Throws the same "Only X ML available" error as an ordinary issue if there is not
 * enough; the request is left pending so it can be tried again or rejected.
 *
 * The pending-status check and the status flip happen inside the same transaction as the blood draw
 * (re-reading the request document fresh, not trusting the possibly-stale object the caller passed in),
 * so two overlapping calls against the same request (a double-click, a retry, two staff at once) can not
 * both succeed: only the first commits, the second sees the now-non-pending status and fails cleanly.
 */
export const fulfilRequest = async (request, organisation) => {
  requireOwnPendingRequest(request, "organisation", organisation);

  const requester = await findUserById(request.requester);
  if (!requester) throw new HttpError(404, "The requester's account no longer exists");
  if (!isApproved(requester)) throw new HttpError(409, "The requester has not been approved yet");

  const now = new Date().toISOString();

  return getDb().runTransaction(async (tx) => {
    const ref = requestsCollection().doc(request._id);
    const fresh = toRequest(await tx.get(ref));
    requireOwnPendingRequest(fresh, "organisation", organisation);

    const record = await recordBlood(
      {
        organisation: fresh.organisation,
        phone: fresh.requesterPhone,
        inventoryType: "out",
        bloodGroup: fresh.bloodGroup,
        quantity: fresh.quantity,
        counterpart: requester,
        requestId: fresh._id,
      },
      tx
    );

    const update = { status: REQUEST_STATUS.FULFILLED, fulfilledRecordId: record._id, updatedAt: now };
    tx.update(ref, update);
    return { ...fresh, ...update };
  });
};

/** Blood bank: turns down a pending request, with a reason the requester sees. */
export const rejectRequest = async (request, organisation, reason) => {
  requireOwnPendingRequest(request, "organisation", organisation);
  const now = new Date().toISOString();

  return getDb().runTransaction(async (tx) => {
    const ref = requestsCollection().doc(request._id);
    const fresh = toRequest(await tx.get(ref));
    requireOwnPendingRequest(fresh, "organisation", organisation);
    const update = { status: REQUEST_STATUS.REJECTED, rejectionReason: reason, updatedAt: now };
    tx.update(ref, update);
    return { ...fresh, ...update };
  });
};

/** The requester: withdraws their own request while it is still pending. */
export const cancelRequest = async (request, requesterId) => {
  requireOwnPendingRequest(request, "requester", requesterId);
  const now = new Date().toISOString();

  return getDb().runTransaction(async (tx) => {
    const ref = requestsCollection().doc(request._id);
    const fresh = toRequest(await tx.get(ref));
    requireOwnPendingRequest(fresh, "requester", requesterId);
    const update = { status: REQUEST_STATUS.CANCELLED, updatedAt: now };
    tx.update(ref, update);
    return { ...fresh, ...update };
  });
};

/** Admin dashboard: how many requests are still waiting for an answer, and how many of those are emergencies. */
export const pendingRequestCounts = async () => {
  const snap = await requestsCollection().where("status", "==", REQUEST_STATUS.PENDING).get();
  const pending = snap.docs.map((doc) => doc.data());
  return {
    pending: pending.length,
    emergency: pending.filter((request) => request.priority === "emergency").length,
  };
};

/**
 * Admin: every blood request across every requester and blood bank, newest first, whoever created it.
 * Reads at most MAX_SCAN documents, like every other admin-wide scan; `truncated` says when there were more.
 */
export const listAllRequests = async () => {
  const snap = await requestsCollection().limit(LIMITS.MAX_SCAN).get();
  return {
    requests: snap.docs.map(toRequest).sort(newestFirst),
    truncated: snap.size === LIMITS.MAX_SCAN,
  };
};
