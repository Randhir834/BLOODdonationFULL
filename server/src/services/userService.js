import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getDb } from "../config/firebase.js";
import {
  APPROVAL_ROLES,
  LIMITS,
  NAME_FIELD,
  ROLES,
  ROLE_LIST,
  USER_STATUS,
  VERIFICATION,
} from "../constants/index.js";
import { HttpError } from "../utils/HttpError.js";
import { usersCollection } from "./collections.js";
import { forgetSessionUser } from "./sessionCache.js";

// Documents are exposed with `_id` (not `id`), which is what both apps read.
// Accounts created before approval existed have no `verification` and count as approved.
const toUser = (doc) =>
  doc.exists ? { _id: doc.id, verification: VERIFICATION.APPROVED, ...doc.data() } : null;

const newestFirst = (a, b) => (a.createdAt < b.createdAt ? 1 : -1);

const isDocId = (id) => typeof id === "string" && id.length > 0 && !id.includes("/");

// Firestore `where()` only matches exactly, so every city-scoped query (requestService.listNearbyRequests)
// compares this normalized key rather than the display `city` string, the same way a request's own
// `cityKey` is copied from the requester's at creation.
const cityKeyOf = (city) => city.trim().toLowerCase();

// Extra details a hospital or blood bank gives about itself on its own website. All optional text.
export const ORG_PROFILE_FIELDS = [
  "email",
  "contactPerson",
  "alternatePhone",
  "emergencyPhone",
  "state",
  "pincode",
  "about",
  "hours",
];

const pickProfile = (source = {}) =>
  Object.fromEntries(ORG_PROFILE_FIELDS.filter((field) => source[field] !== undefined).map((field) => [field, source[field]]));

/** A registration or licence number reduced to what identifies it ("KA/BB 001" and "kabb001" are one). */
export const registrationKeyOf = (number) => String(number || "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** The name a user goes by, whichever role they have. */
export const displayName = (user) => user[NAME_FIELD[user.role]] || user.phone;

/** The approval state of a user, tolerant of profiles that do not carry one (they are approved). */
export const verificationOf = (user) => user.verification ?? VERIFICATION.APPROVED;

/** True when the user may use the app: donors always, hospitals and blood banks once an admin approved them. */
export const isApproved = (user) =>
  !APPROVAL_ROLES.includes(user.role) || verificationOf(user) === VERIFICATION.APPROVED;

export const findUserById = async (id) => {
  if (!isDocId(id)) return null;
  return toUser(await usersCollection().doc(id).get());
};

export const findUserByPhone = async (phone) => {
  if (!phone) return null;
  const snap = await usersCollection().where("phone", "==", phone).limit(1).get();
  return snap.empty ? null : toUser(snap.docs[0]);
};

// What an admin records while reviewing an account. Other users never see it.
const ADMIN_ONLY_FIELDS = [
  "registrationNumber",
  "verificationReason",
  "verifiedAt",
  "verifiedBy",
  "statusReason",
  "statusUpdatedAt",
  "registrationKey",
  "resubmittedAt",
];

// Live location only ever leaves the server through locationService's own, purpose-built endpoints
// (which filter by who is sharing, and never return a donor's location to anyone but an admin). It
// must never leak through this generic "one user viewing another's profile" path instead.
const LOCATION_FIELDS = ["location", "locationSharing"];

const withoutAdminFields = (user) => {
  const visible = { ...user };
  [...ADMIN_ONLY_FIELDS, ...LOCATION_FIELDS].forEach((field) => delete visible[field]);
  return visible;
};

/** The profiles of the given users, as other people may see them (no admin review details). */
export const findUsersByIds = async (ids) => {
  const unique = [...new Set(ids.filter(isDocId))];
  if (unique.length === 0) return [];
  const docs = await getDb().getAll(...unique.map((id) => usersCollection().doc(id)));
  return docs.map(toUser).filter(Boolean).map(withoutAdminFields);
};

/**
 * Every blood bank a hospital may pick when asking for blood: active and approved, with no admin
 * review details. Unlike `listUsers`, this is for other users, not admins, so it is filtered and
 * stripped the same way `findUsersByIds` is.
 */
export const listApprovedOrganisations = async () => {
  const snap = await usersCollection().where("role", "==", ROLES.ORGANISATION).limit(LIMITS.MAX_SCAN).get();
  return snap.docs
    .map(toUser)
    .filter((org) => org.status !== USER_STATUS.SUSPENDED && isApproved(org))
    .map(withoutAdminFields)
    .sort((a, b) => displayName(a).localeCompare(displayName(b)));
};

/** Admin: newest users first, optionally of one role. `truncated` is true when more exist. */
export const listUsers = async (role) => {
  const query = role
    ? usersCollection().where("role", "==", role).limit(LIMITS.MAX_SCAN)
    : usersCollection().orderBy("createdAt", "desc").limit(LIMITS.MAX_SCAN);
  const snap = await query.get();
  return {
    users: snap.docs.map(toUser).sort(newestFirst),
    truncated: snap.size === LIMITS.MAX_SCAN,
  };
};

/**
 * Creates the profile of a phone number that just signed in for the first time.
 * `uid` and `phone` come from the verified Firebase token, never from the request body.
 * Returns null when the profile already exists.
 */
export const createUser = async (
  uid,
  phone,
  { role, name, address, city, website, registrationNumber, bloodGroup, profile }
) => {
  const now = new Date().toISOString();
  const needsApproval = APPROVAL_ROLES.includes(role);
  const record = {
    role,
    [NAME_FIELD[role]]: name,
    address,
    city,
    cityKey: cityKeyOf(city),
    website,
    phone,
    status: USER_STATUS.ACTIVE,
    // A hospital or blood bank waits for an admin, a donor can start right away.
    verification: needsApproval ? VERIFICATION.PENDING : VERIFICATION.APPROVED,
    ...(needsApproval && { registrationNumber, registrationKey: registrationKeyOf(registrationNumber) }),
    ...(needsApproval && pickProfile(profile)),
    ...(needsApproval && profile?.open24x7 !== undefined && { open24x7: profile.open24x7 }),
    // Only a donor's own blood type is ever meaningful; it drives blood-request notification matching.
    ...(role === ROLES.DONOR && bloodGroup && { bloodGroup }),
    createdAt: now,
    updatedAt: now,
  };

  const ref = usersCollection().doc(uid);
  const created = await getDb().runTransaction(async (tx) => {
    if ((await tx.get(ref)).exists) return false;
    tx.set(ref, record);
    return true;
  });
  return created ? { _id: uid, ...record } : null;
};

/** Admin: edits the profile and/or moves the user to another role. Returns null when the user is missing. */
export const updateUser = async (id, patch) => {
  const user = await findUserById(id);
  if (!user) return null;

  const role = patch.role ?? user.role;
  const nameField = NAME_FIELD[role];
  const name = patch.name ?? user[NAME_FIELD[user.role]] ?? "";
  const address = patch.address ?? user.address ?? "";
  const website = patch.website ?? user.website ?? "";
  if (!ROLE_LIST.includes(role)) throw new HttpError(400, "Invalid role");
  if (!name) throw new HttpError(400, "Name is required");
  if (!address) throw new HttpError(400, "Address is required");

  const update = { role, [nameField]: name, address, website, updatedAt: new Date().toISOString() };
  // A role change moves the name to the field that role uses.
  Object.values(NAME_FIELD).forEach((field) => {
    if (field !== nameField) update[field] = FieldValue.delete();
  });
  // A blood group is only ever meaningful for a donor; moving away from that role drops it.
  if (role === ROLES.DONOR && patch.bloodGroup) update.bloodGroup = patch.bloodGroup;
  else if (role !== ROLES.DONOR) update.bloodGroup = FieldValue.delete();
  await usersCollection().doc(id).update(update);
  forgetSessionUser(id);
  return findUserById(id);
};

/**
 * The signed-in user corrects their own address/city (e.g. an account created before `city` existed).
 * Deliberately not gated on approval status: a hospital or blood bank still awaiting review must still
 * be able to set the city that later gets it found, not be blocked on it.
 */
export const updateOwnProfile = async (user, { address, city }) => {
  const update = { address, city, cityKey: cityKeyOf(city), updatedAt: new Date().toISOString() };
  await usersCollection().doc(user._id).update(update);
  forgetSessionUser(user._id);
  return findUserById(user._id);
};

/** The hospital or blood bank already using this registration number, or null. */
export const findOrganisationByRegistration = async (number) => {
  const key = registrationKeyOf(number);
  if (!key) return null;
  const snap = await usersCollection().where("registrationKey", "==", key).limit(1).get();
  return snap.empty ? null : toUser(snap.docs[0]);
};

/**
 * A hospital or blood bank edits its own profile from its website. The registration number can only change
 * while the account is not approved (afterwards it is what the approval was based on, so an admin changes it).
 * Deliberately not gated on approval: an organisation waiting for, or refused, approval must be able to correct
 * its details.
 */
export const updateOrgProfile = async (user, patch) => {
  if (!APPROVAL_ROLES.includes(user.role)) throw new HttpError(403, "Only a hospital or blood bank has an organisation profile");
  if (patch.registrationNumber !== undefined && patch.registrationNumber !== user.registrationNumber) {
    if (verificationOf(user) === VERIFICATION.APPROVED) {
      throw new HttpError(400, "The registration number can not be changed after approval, contact an admin");
    }
    const other = await findOrganisationByRegistration(patch.registrationNumber);
    if (other && other._id !== user._id) throw new HttpError(409, "This registration number is already registered");
  }

  const update = { updatedAt: new Date().toISOString(), ...pickProfile(patch) };
  if (patch.name !== undefined) update[NAME_FIELD[user.role]] = patch.name;
  if (patch.address !== undefined) update.address = patch.address;
  if (patch.website !== undefined) update.website = patch.website;
  if (patch.open24x7 !== undefined) update.open24x7 = patch.open24x7;
  if (patch.city !== undefined) Object.assign(update, { city: patch.city, cityKey: cityKeyOf(patch.city) });
  if (patch.registrationNumber !== undefined) {
    Object.assign(update, {
      registrationNumber: patch.registrationNumber,
      registrationKey: registrationKeyOf(patch.registrationNumber),
    });
  }
  await usersCollection().doc(user._id).update(update);
  forgetSessionUser(user._id);
  return findUserById(user._id);
};

/** A refused organisation, having corrected its details, asks for another review. */
export const resubmitForReview = async (user) => {
  if (verificationOf(user) !== VERIFICATION.REJECTED) throw new HttpError(400, "Only a refused registration can be sent for review again");
  await usersCollection()
    .doc(user._id)
    .update({ verification: VERIFICATION.PENDING, verificationReason: "", resubmittedAt: new Date().toISOString() });
  forgetSessionUser(user._id);
  return findUserById(user._id);
};

/** Admin: a suspended user is signed out and can not sign in again until reactivated. */
export const setUserStatus = async (id, status, reason = "") => {
  const user = await findUserById(id);
  if (!user) return null;

  const suspended = status === USER_STATUS.SUSPENDED;
  const auth = getAdminAuth();
  try {
    await auth.updateUser(id, { disabled: suspended });
    if (suspended) await auth.revokeRefreshTokens(id);
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
  }
  await usersCollection()
    .doc(id)
    .update({
      status,
      statusReason: suspended ? reason : "",
      statusUpdatedAt: new Date().toISOString(),
    });
  forgetSessionUser(id);
  return findUserById(id);
};

/**
 * Admin: approves or rejects a hospital or blood bank. A rejection carries the reason the person sees.
 * Returns null when the user is missing. Donors do not need approval.
 */
export const setVerification = async (id, verification, { reason = "", adminEmail } = {}) => {
  const user = await findUserById(id);
  if (!user) return null;
  if (!APPROVAL_ROLES.includes(user.role)) throw new HttpError(400, "Donors do not need approval");

  await usersCollection()
    .doc(id)
    .update({
      verification,
      verificationReason: verification === VERIFICATION.REJECTED ? reason : "",
      verifiedAt: new Date().toISOString(),
      verifiedBy: adminEmail ?? "",
    });
  forgetSessionUser(id);
  return findUserById(id);
};

/**
 * Removes the phone login first, then the profile, so a half finished delete can be retried
 * and the number can never sign in to a profile-less account.
 */
export const deleteUser = async (id) => {
  if (!isDocId(id)) return;
  try {
    await getAdminAuth().deleteUser(id);
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
  }
  await usersCollection().doc(id).delete();
  forgetSessionUser(id);
};
