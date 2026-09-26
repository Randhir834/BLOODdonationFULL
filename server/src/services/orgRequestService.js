import { getDb } from "../config/firebase.js";
import {
  LIMITS,
  REQUEST_PRIORITY,
  REQUEST_STATUS,
  RESPONSE_STATUS,
  STANDARD_UNIT_ML,
} from "../constants/index.js";
import { HttpError } from "../utils/HttpError.js";
import {
  requestDismissalsCollection,
  requestResponsesCollection,
  requestsCollection,
} from "./collections.js";
import { ledgerFor, organisationTotals, populate, recordBlood } from "./inventoryService.js";
import { findOwnResponse, listResponsesForRequest } from "./responseService.js";
import { displayName, findUserById, isApproved } from "./userService.js";

/*
 * The hospital / blood bank view of blood requests. One list covers every request that concerns the
 * organisation: the ones it raised, the ones sent straight to it, and everyone else's in its city. What the
 * organisation can do with each row depends only on how that row relates to it (see `actionsFor`).
 */

const newestFirst = (a, b) => (a.createdAt < b.createdAt ? 1 : -1);
const toDoc = (doc) => ({ _id: doc.id, ...doc.data() });
const PRIORITY_RANK = {
  [REQUEST_PRIORITY.EMERGENCY]: 0,
  [REQUEST_PRIORITY.URGENT]: 1,
  [REQUEST_PRIORITY.NORMAL]: 2,
};

const dismissalId = (orgId, requestId) => `${orgId}_${requestId}`;

/** How a request relates to an organisation: it raised it, it was sent to it, or it is in the same city. */
export const relationOf = (request, org) => {
  if (request.requester === org._id) return "mine";
  if (request.organisation === org._id) return "addressed";
  return "city";
};

/** Blood (ML) an organisation could issue right now for a group. */
export const availableMl = async (org, bloodGroup) => {
  const { totals } = await organisationTotals(org._id, ledgerFor(org));
  return totals[bloodGroup]?.available ?? 0;
};

/**
 * What the organisation may do with a request right now. `respond` is offering blood against someone else's
 * request, `fulfil` / `reject` answer one sent straight to a blood bank, `dispatch` issues blood for an offer
 * the requester confirmed. The rest are the requester's own tools.
 */
const actionsFor = ({ request, relation, org, myResponse, pendingResponses, dismissed }) => {
  const pending = request.status === REQUEST_STATUS.PENDING;
  const actions = [];
  if (relation === "mine") {
    if (pending) actions.push("edit", "cancel");
    if (pending && pendingResponses > 0) actions.push("review-offers");
  } else {
    if (pending && relation === "addressed" && org.role === "organisation") actions.push("fulfil", "reject");
    // An offer that was withdrawn or declined does not stop the organisation offering again.
    const offerOpen = [RESPONSE_STATUS.PENDING, RESPONSE_STATUS.CONFIRMED].includes(myResponse?.status);
    if (pending && !offerOpen && !dismissed) actions.push("respond");
    if (pending && myResponse?.status === RESPONSE_STATUS.PENDING) actions.push("withdraw");
    if (pending && !offerOpen && relation === "city") actions.push(dismissed ? "restore" : "dismiss");
  }
  const closedWithoutBlood = [REQUEST_STATUS.CANCELLED, REQUEST_STATUS.REJECTED].includes(request.status);
  if (
    myResponse?.status === RESPONSE_STATUS.CONFIRMED &&
    !myResponse.dispatchedRecordId &&
    !closedWithoutBlood
  ) {
    actions.push("dispatch");
  }
  return actions;
};

// Actions that mean "this is waiting for the organisation to do something".
const WAITING_ON_ME = ["respond", "fulfil", "review-offers", "dispatch"];

const requestsByIds = async (ids) =>
  ids.length === 0
    ? []
    : (await getDb().getAll(...ids.map((id) => requestsCollection().doc(id))))
        .filter((doc) => doc.exists)
        .map(toDoc);

/** Every request that concerns `org`, before any filter is applied. */
const gatherRequests = async (org) => {
  const scan = (query) => query.limit(LIMITS.MAX_SCAN).get();
  const [mine, addressed, city, responses, dismissals] = await Promise.all([
    scan(requestsCollection().where("requester", "==", org._id)),
    scan(requestsCollection().where("organisation", "==", org._id)),
    org.cityKey ? scan(requestsCollection().where("cityKey", "==", org.cityKey)) : { docs: [] },
    scan(requestResponsesCollection().where("responderId", "==", org._id)),
    scan(requestDismissalsCollection().where("organisation", "==", org._id)),
  ]);

  const requests = new Map();
  [mine, addressed, city].forEach((snap) => snap.docs.forEach((doc) => requests.set(doc.id, toDoc(doc))));

  // An organisation keeps seeing a request it answered even if its own city changed since.
  const myResponses = new Map();
  responses.docs
    .map(toDoc)
    .sort(newestFirst)
    .forEach((response) => {
      if (!myResponses.has(response.requestId)) myResponses.set(response.requestId, response);
    });
  const missing = [...myResponses.keys()].filter((id) => !requests.has(id));
  (await requestsByIds(missing)).forEach((request) => requests.set(request._id, request));

  return {
    requests: [...requests.values()],
    myResponses,
    dismissed: new Set(dismissals.docs.map((doc) => doc.get("requestId"))),
    truncated: [mine, addressed, city].some((snap) => snap.docs.length >= LIMITS.MAX_SCAN),
  };
};

const isExpired = (request, nowIso) =>
  request.status === REQUEST_STATUS.PENDING && Boolean(request.requiredAt) && request.requiredAt < nowIso;

/**
 * The organisation's unified request list with filters. Each row carries its `relation`, the organisation's own
 * response (if any), what it may do (`actions`) and, for its own requests, how many offers wait for it.
 * `stats` counts everything before filtering, so the page's headline numbers stay put while filtering.
 */
export const listOrgRequests = async (org, filters = {}) => {
  const { requests, myResponses, dismissed, truncated } = await gatherRequests(org);
  const nowIso = new Date().toISOString();

  // Offers waiting on the organisation's own open requests.
  const ownOpen = requests.filter(
    (request) => request.requester === org._id && request.status === REQUEST_STATUS.PENDING
  );
  const pendingByRequest = new Map();
  await Promise.all(
    ownOpen.slice(0, 100).map(async (request) => {
      const responses = await listResponsesForRequest(request._id);
      pendingByRequest.set(request._id, responses.filter((r) => r.status === RESPONSE_STATUS.PENDING).length);
    })
  );

  const rows = requests.map((request) => {
    const relation = relationOf(request, org);
    const myResponse = myResponses.get(request._id) ?? null;
    const isDismissed = dismissed.has(request._id);
    const pendingResponses = pendingByRequest.get(request._id) ?? 0;
    const actions = actionsFor({
      request,
      relation,
      org,
      myResponse,
      pendingResponses,
      dismissed: isDismissed,
    });
    const expired = isExpired(request, nowIso);
    return {
      ...request,
      relation,
      myResponse,
      dismissed: isDismissed,
      pendingResponses,
      expired,
      actions,
      needsAction: !expired && actions.some((action) => WAITING_ON_ME.includes(action)) && !isDismissed,
    };
  });

  const stats = {
    total: rows.length,
    needsAction: rows.filter((row) => row.needsAction).length,
    open: rows.filter((row) => row.status === REQUEST_STATUS.PENDING && !row.expired).length,
    mine: rows.filter((row) => row.relation === "mine").length,
    addressed: rows.filter((row) => row.relation === "addressed").length,
    city: rows.filter((row) => row.relation === "city").length,
    emergency: rows.filter(
      (row) =>
        row.priority === REQUEST_PRIORITY.EMERGENCY &&
        row.status === REQUEST_STATUS.PENDING &&
        !row.expired &&
        row.relation !== "mine" &&
        !row.dismissed
    ).length,
  };

  const { relation, status, bloodGroup, priority, needsAction, dismissed: showDismissed, from, to } = filters;
  let filtered = rows.filter((row) => {
    if (relation && row.relation !== relation) return false;
    if (status === "expired") {
      if (!row.expired) return false;
    } else if (status && row.status !== status) return false;
    if (bloodGroup && row.bloodGroup !== bloodGroup) return false;
    if (priority && row.priority !== priority) return false;
    if (needsAction && !row.needsAction) return false;
    // Dismissed requests stay out of the list unless asked for.
    if (showDismissed ? !row.dismissed : row.dismissed) return false;
    const day = row.createdAt.slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  });

  if (filters.sort === "priority") {
    filtered = filtered.sort(
      (a, b) => (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3) || newestFirst(a, b)
    );
  } else if (filters.sort === "needed") {
    filtered = filtered.sort(
      (a, b) => (a.requiredAt || "9999").localeCompare(b.requiredAt || "9999") || newestFirst(a, b)
    );
  } else filtered = filtered.sort(newestFirst);

  // Names are looked up once, for the requests that survived the filters, so a search can match them too.
  const named = await populate(filtered, ["requester", "organisation"]);
  const needle = (filters.q || "").trim().toLowerCase();
  const matched = needle
    ? named.filter((row) =>
        [
          row.patientName,
          row.location,
          row.requesterPhone,
          row.contactName,
          row.contactPhone,
          row.city,
          row.requester && displayName(row.requester),
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(needle)
        )
      )
    : named;

  return { requests: matched, stats, truncated };
};

/** A request the organisation may see, or a 404: others' requests outside its city and dealings stay private. */
const visibleRequestOr404 = async (org, id) => {
  const doc =
    typeof id === "string" && id && !id.includes("/") ? await requestsCollection().doc(id).get() : null;
  if (!doc?.exists) throw new HttpError(404, "Request not found");
  const request = toDoc(doc);
  const involved = request.requester === org._id || request.organisation === org._id;
  const sameCity = Boolean(org.cityKey) && request.cityKey === org.cityKey;
  if (!involved && !sameCity && !(await findOwnResponse(request._id, org._id))) {
    throw new HttpError(404, "Request not found");
  }
  return request;
};

/** One request with everything needed to act on it: offers, the organisation's own offer, its stock, a timeline. */
export const getOrgRequest = async (org, id) => {
  const request = await visibleRequestOr404(org, id);
  const relation = relationOf(request, org);
  const [myResponse, dismissal, stock, allResponses] = await Promise.all([
    findOwnResponse(request._id, org._id),
    requestDismissalsCollection().doc(dismissalId(org._id, request._id)).get(),
    availableMl(org, request.bloodGroup),
    relation === "mine" ? listResponsesForRequest(request._id) : [],
  ]);
  const responses = await populate(allResponses, ["responderId"]);
  const [populated] = await populate([request], ["requester", "organisation"]);
  const pendingResponses = allResponses.filter((r) => r.status === RESPONSE_STATUS.PENDING).length;
  const dismissed = dismissal.exists;

  const events = [{ at: request.createdAt, kind: "created", text: "Request raised" }];
  allResponses.forEach((response) => {
    events.push({ at: response.createdAt, kind: "offer", text: `${response.unitsOffered} unit(s) offered` });
    if (response.dispatchedAt)
      events.push({
        at: response.dispatchedAt,
        kind: "dispatched",
        text: `${response.dispatchedMl} ML issued`,
      });
  });
  if (myResponse && relation !== "mine") {
    events.push({
      at: myResponse.createdAt,
      kind: "offer",
      text: `You offered ${myResponse.unitsOffered} unit(s)`,
    });
    if (myResponse.status === RESPONSE_STATUS.CONFIRMED)
      events.push({ at: myResponse.updatedAt, kind: "confirmed", text: "Your offer was confirmed" });
    if (myResponse.status === RESPONSE_STATUS.DECLINED)
      events.push({ at: myResponse.updatedAt, kind: "declined", text: "Your offer was declined" });
    if (myResponse.dispatchedAt)
      events.push({
        at: myResponse.dispatchedAt,
        kind: "dispatched",
        text: `You issued ${myResponse.dispatchedMl} ML`,
      });
  }
  if (request.status !== REQUEST_STATUS.PENDING) {
    events.push({ at: request.updatedAt, kind: request.status, text: `Request ${request.status}` });
  }
  events.sort((a, b) => (a.at < b.at ? -1 : 1));

  return {
    request: {
      ...populated,
      relation,
      expired: isExpired(request, new Date().toISOString()),
      actions: actionsFor({ request, relation, org, myResponse, pendingResponses, dismissed }),
      dismissed,
      pendingResponses,
    },
    myResponse,
    responses: relation === "mine" ? responses : [],
    stock: { bloodGroup: request.bloodGroup, availableMl: stock, neededMl: request.quantity },
    timeline: events,
  };
};

/** Hides (or shows again) someone else's request in the organisation's own list. */
export const setDismissed = async (org, id, dismissed) => {
  const request = await visibleRequestOr404(org, id);
  if (request.requester === org._id) throw new HttpError(400, "You can not hide your own request");
  const ref = requestDismissalsCollection().doc(dismissalId(org._id, request._id));
  if (dismissed)
    await ref.set({ organisation: org._id, requestId: request._id, createdAt: new Date().toISOString() });
  else await ref.delete();
  return request;
};

/** Makes sure the organisation is not promising blood it does not have. */
export const requireStockFor = async (org, bloodGroup, ml) => {
  const have = await availableMl(org, bloodGroup);
  if (have < ml)
    throw new HttpError(409, `You only have ${have} ML of ${bloodGroup} in stock, ${ml} ML would be needed`);
};

/**
 * The organisation issues blood for an offer the requester confirmed: the confirmed units (one unit is
 * `STANDARD_UNIT_ML`) are drawn from its own stock, first-expiring-first, and the offer is marked issued, all
 * in one transaction so blood is never issued twice for one offer.
 */
export const dispatchResponse = async (request, response, org) => {
  if (response.responderId !== org._id || response.requestId !== request._id)
    throw new HttpError(404, "Offer not found");
  if (response.status !== RESPONSE_STATUS.CONFIRMED)
    throw new HttpError(400, "Only an offer the requester confirmed can be issued");
  if ([REQUEST_STATUS.CANCELLED, REQUEST_STATUS.REJECTED].includes(request.status)) {
    throw new HttpError(400, `This request was ${request.status}`);
  }
  if (response.dispatchedRecordId) throw new HttpError(409, "Blood was already issued for this offer");

  const requester = await findUserById(request.requester);
  if (!requester) throw new HttpError(404, "The requester's account no longer exists");
  if (!isApproved(requester)) throw new HttpError(409, "The requester has not been approved yet");

  const quantity = (response.unitsApplied ?? response.unitsOffered) * STANDARD_UNIT_ML;
  const now = new Date().toISOString();

  return getDb().runTransaction(async (tx) => {
    const responseRef = requestResponsesCollection().doc(response._id);
    const fresh = toDoc(await tx.get(responseRef));
    if (fresh.status !== RESPONSE_STATUS.CONFIRMED)
      throw new HttpError(400, `This offer is already ${fresh.status}`);
    if (fresh.dispatchedRecordId) throw new HttpError(409, "Blood was already issued for this offer");

    const record = await recordBlood(
      {
        organisation: org._id,
        phone: request.requesterPhone,
        inventoryType: "out",
        bloodGroup: request.bloodGroup,
        quantity,
        counterpart: requester,
        requestId: request._id,
        ledger: ledgerFor(org),
        details: {
          reference: `Request ${request._id.slice(-6).toUpperCase()}`,
          recordedBy: displayName(org),
        },
      },
      tx
    );
    const update = {
      dispatchedAt: now,
      dispatchedRecordId: record._id,
      dispatchedMl: quantity,
      updatedAt: now,
    };
    tx.update(responseRef, update);
    return { response: { ...fresh, ...update }, record, quantity };
  });
};
