import { getDb } from "../config/firebase.js";
import { env } from "../config/env.js";
import {
  APPROVAL_ROLES,
  LIMITS,
  NOTIFICATION_TYPE,
  REQUEST_PRIORITY,
  USER_STATUS,
  VERIFICATION,
} from "../constants/index.js";
import { HttpError } from "../utils/HttpError.js";
import { logger } from "../utils/logger.js";
import { notificationsCollection, requestResponsesCollection, usersCollection } from "./collections.js";
import { displayName, isApproved } from "./userService.js";

// Firestore allows 500 writes in one batch; stay comfortably under it.
const BATCH_SIZE = 400;

const isDocId = (id) => typeof id === "string" && id.length > 0 && !id.includes("/");
const toNotification = (doc) => ({ _id: doc.id, ...doc.data() });
const newestFirst = (a, b) => (a.createdAt < b.createdAt ? 1 : -1);

/**
 * Writes one notification per recipient. Never throws: like the activity log, a notification that could not
 * be written is logged and the action that caused it still succeeds. Returns how many were written.
 * `link` says what to open, e.g. { type: "request", id }.
 */
export const notify = async (recipients, { type, title, body = "", link = null }) => {
  const ids = [...new Set(recipients.filter(isDocId))];
  if (ids.length === 0) return 0;
  try {
    const db = getDb();
    const createdAt = new Date().toISOString();
    for (let start = 0; start < ids.length; start += BATCH_SIZE) {
      const batch = db.batch();
      ids.slice(start, start + BATCH_SIZE).forEach((recipient) => {
        batch.set(notificationsCollection().doc(), {
          recipient,
          type,
          title,
          body,
          link,
          read: false,
          createdAt,
        });
      });
      await batch.commit();
    }
    return ids.length;
  } catch (err) {
    logger.error({ err, type }, "Notification write failed");
    return 0;
  }
};

/** Hospitals and blood banks that may act on a request: approved, not suspended, and not `exceptId`. */
const activeOrganisationsIn = async (cityKey, exceptId) => {
  if (!cityKey) return [];
  const snap = await usersCollection().where("cityKey", "==", cityKey).limit(LIMITS.MAX_SCAN).get();
  return snap.docs
    .map((doc) => ({ _id: doc.id, ...doc.data() }))
    .filter(
      (user) =>
        APPROVAL_ROLES.includes(user.role) &&
        user._id !== exceptId &&
        user.status !== USER_STATUS.SUSPENDED &&
        isApproved(user)
    );
};

const requestLabel = (request) => `${request.quantity} ML ${request.bloodGroup}`;
const link = (request) => ({ type: "request", id: request._id });

/**
 * A request was raised: every other hospital and blood bank in the requester's city hears about it, and so
 * does the blood bank it names directly, if it names one and that one is somewhere else.
 */
export const notifyNewRequest = async (request) => {
  try {
    const nearby = (await activeOrganisationsIn(request.cityKey, request.requester)).map((user) => user._id);
    const direct =
      request.organisation && request.organisation !== request.requester ? [request.organisation] : [];
    const emergency = request.priority === REQUEST_PRIORITY.EMERGENCY;
    await notify([...nearby, ...direct], {
      type: NOTIFICATION_TYPE.REQUEST_NEW,
      title: `${emergency ? "Emergency: " : ""}${requestLabel(request)} needed${request.city ? ` in ${request.city}` : ""}`,
      body: [request.patientName && `Patient ${request.patientName}`, request.location]
        .filter(Boolean)
        .join(" · "),
      link: link(request),
    });
  } catch (err) {
    logger.error({ err }, "Could not notify about a new request");
  }
};

/** Someone offered blood against a request: its requester hears about it. */
export const notifyResponse = async (request, response, responder) =>
  notify([request.requester], {
    type: NOTIFICATION_TYPE.REQUEST_RESPONSE,
    title: `${displayName(responder)} offered ${response.unitsOffered} unit${response.unitsOffered === 1 ? "" : "s"}`,
    body: `For your request of ${requestLabel(request)}. Open the request to confirm or decline.`,
    link: link(request),
  });

/** The requester confirmed or declined an offer: its responder hears about it. */
export const notifyResponseDecision = async (request, response, decision) =>
  notify([response.responderId], {
    type: NOTIFICATION_TYPE.RESPONSE_DECISION,
    title: `Your offer was ${decision}`,
    body:
      decision === "confirmed"
        ? `${response.unitsApplied ?? response.unitsOffered} unit(s) for ${requestLabel(request)}. Issue the blood from your stock when ready.`
        : `For the request of ${requestLabel(request)}.`,
    link: link(request),
  });

/** A request changed state for the people who answered it (fulfilled, cancelled) or asked it (rejected). */
export const notifyRequestUpdate = async (request, recipients, title) =>
  notify(recipients, {
    type: NOTIFICATION_TYPE.REQUEST_UPDATE,
    title,
    body: requestLabel(request),
    link: link(request),
  });

/** Blood was sent against a confirmed offer: the requester hears about it. */
export const notifyDispatched = async (request, responder, quantity) =>
  notify([request.requester], {
    type: NOTIFICATION_TYPE.RESPONSE_DISPATCHED,
    title: `${displayName(responder)} issued ${quantity} ML of ${request.bloodGroup}`,
    body: `Against your request of ${requestLabel(request)}.`,
    link: link(request),
  });

/** An admin decided a registration: the hospital or blood bank hears about it. */
export const notifyAccountDecision = async (user, verification, reason = "") =>
  notify([user._id], {
    type: NOTIFICATION_TYPE.ACCOUNT_DECISION,
    title:
      verification === VERIFICATION.APPROVED
        ? "Your registration was approved"
        : "Your registration was not approved",
    body:
      verification === VERIFICATION.APPROVED
        ? "You can now manage your stock and blood requests."
        : reason || "Open your profile to see why and to correct your details.",
    link: { type: "profile", id: user._id },
  });

/**
 * After blood leaves stock (issued or discarded): tells the owner when a blood group has just fallen
 * under the low-stock line. `removedMl` is how much just left, `availableNow` what is left afterwards; it
 * only fires on the crossing, not on every issue while the group stays low.
 */
export const notifyIfLowStock = async (owner, bloodGroup, removedMl, availableNow) => {
  if (availableNow >= env.LOW_STOCK_ML || availableNow + removedMl < env.LOW_STOCK_ML) return;
  await notify([owner._id], {
    type: NOTIFICATION_TYPE.STOCK_LOW,
    title: availableNow <= 0 ? `${bloodGroup} is out of stock` : `${bloodGroup} is running low`,
    body: `${Math.max(0, availableNow)} ML left, the low-stock line is ${env.LOW_STOCK_ML} ML.`,
    link: { type: "stock", id: bloodGroup },
  });
};

/** The account's notifications, newest first (at most `limit`), and how many of them are unread. */
export const listNotifications = async (recipient, { unreadOnly = false, limit = 50 } = {}) => {
  let query = notificationsCollection().where("recipient", "==", recipient);
  if (unreadOnly) query = query.where("read", "==", false);
  const snap = await query.limit(LIMITS.MAX_SCAN).get();
  const all = snap.docs.map(toNotification).sort(newestFirst);
  return { notifications: all.slice(0, limit), total: all.length };
};

export const countUnread = async (recipient) => {
  const snap = await notificationsCollection()
    .where("recipient", "==", recipient)
    .where("read", "==", false)
    .count()
    .get();
  return snap.data().count;
};

/** Marks one of the account's own notifications read; anyone else's is reported as not found. */
export const markRead = async (recipient, id) => {
  if (!isDocId(id)) throw new HttpError(404, "Notification not found");
  const ref = notificationsCollection().doc(id);
  const doc = await ref.get();
  if (!doc.exists || doc.data().recipient !== recipient) throw new HttpError(404, "Notification not found");
  if (!doc.data().read) await ref.update({ read: true, readAt: new Date().toISOString() });
};

export const markAllRead = async (recipient) => {
  const snap = await notificationsCollection()
    .where("recipient", "==", recipient)
    .where("read", "==", false)
    .limit(LIMITS.MAX_SCAN)
    .get();
  const now = new Date().toISOString();
  for (let start = 0; start < snap.docs.length; start += BATCH_SIZE) {
    const batch = getDb().batch();
    snap.docs
      .slice(start, start + BATCH_SIZE)
      .forEach((doc) => batch.update(doc.ref, { read: true, readAt: now }));
    await batch.commit();
  }
  return snap.docs.length;
};

/** Every donor, hospital and blood bank account keeps its own notifications; deleting the account drops them. */
export const deleteFor = async (recipient) => {
  const snap = await notificationsCollection()
    .where("recipient", "==", recipient)
    .limit(LIMITS.MAX_SCAN)
    .get();
  for (let start = 0; start < snap.docs.length; start += BATCH_SIZE) {
    const batch = getDb().batch();
    snap.docs.slice(start, start + BATCH_SIZE).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
};

/** A request was cancelled: everyone whose offer was still open on it hears about it. */
export const notifyRequestCancelled = async (request) => {
  try {
    const snap = await requestResponsesCollection().where("requestId", "==", request._id).get();
    const responders = snap.docs
      .map((doc) => doc.data())
      .filter((response) => ["pending", "confirmed"].includes(response.status))
      .map((response) => response.responderId);
    await notifyRequestUpdate(request, responders, "A request you offered to help with was cancelled");
  } catch (err) {
    logger.error({ err }, "Could not notify about a cancelled request");
  }
};
