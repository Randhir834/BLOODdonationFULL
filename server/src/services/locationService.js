import { FieldValue } from "firebase-admin/firestore";
import { LIMITS, ROLES, USER_STATUS, VERIFICATION } from "../constants/index.js";
import { usersCollection } from "./collections.js";
import { forgetSessionUser } from "./sessionCache.js";
import { displayName, verificationOf } from "./userService.js";

// A user's profile, reduced to what a map marker needs. Admin-only fields (registration number,
// verification notes, ...) never leave userService, so they are never at risk of being included here.
const toLocatable = (doc) => {
  const data = doc.data();
  return {
    _id: doc.id,
    role: data.role,
    name: displayName(data),
    address: data.address || "",
    phone: data.phone,
    location: data.location || null,
    status: data.status || USER_STATUS.ACTIVE,
    verification: verificationOf(data),
  };
};

const shareableQuery = (role) =>
  usersCollection().where("role", "==", role).where("locationSharing", "==", true).limit(LIMITS.MAX_SCAN).get();

/** Records where a device says it currently is. Only the signed-in user may set their own. */
export const updateLocation = async (user, { lat, lng, accuracy }) => {
  const now = new Date().toISOString();
  const location = { lat, lng, accuracy: accuracy ?? null, updatedAt: now };
  await usersCollection().doc(user._id).update({ location, locationSharing: true, updatedAt: now });
  forgetSessionUser(user._id);
  return location;
};

/** Turning sharing off deletes the stored location too, so nothing stale lingers once it is disabled. */
export const setSharing = async (user, enabled) => {
  const now = new Date().toISOString();
  const update = enabled
    ? { locationSharing: true, updatedAt: now }
    : { locationSharing: false, location: FieldValue.delete(), updatedAt: now };
  await usersCollection().doc(user._id).update(update);
  forgetSessionUser(user._id);
  return enabled;
};

/**
 * Hospitals and blood banks that are sharing their location, for the "nearby" map every signed-in
 * user (donor, hospital or organisation) can see. Donors are never included here: a donor's live
 * location is only ever visible to an admin, see `listForAdmin`.
 */
export const listNearbyPeople = async () => {
  const [hospitals, organisations] = await Promise.all([
    shareableQuery(ROLES.HOSPITAL),
    shareableQuery(ROLES.ORGANISATION),
  ]);
  return [...hospitals.docs, ...organisations.docs]
    .map(toLocatable)
    .filter((person) => person.status !== USER_STATUS.SUSPENDED && person.verification === VERIFICATION.APPROVED);
};

/** Every donor, hospital and blood bank currently sharing their location, for the admin map only. */
export const listForAdmin = async () => {
  const [donors, hospitals, organisations] = await Promise.all([
    shareableQuery(ROLES.DONOR),
    shareableQuery(ROLES.HOSPITAL),
    shareableQuery(ROLES.ORGANISATION),
  ]);
  return [...donors.docs, ...hospitals.docs, ...organisations.docs].map(toLocatable);
};
