import { CAMP_STATUS, LIMITS } from "../constants/index.js";
import { HttpError } from "../utils/HttpError.js";
import { campsCollection } from "./collections.js";

const toCamp = (doc) => (doc.exists ? { _id: doc.id, ...doc.data() } : null);
const newestFirst = (a, b) => (a.createdAt < b.createdAt ? 1 : -1);

const findCampById = async (id) => toCamp(await campsCollection().doc(id).get());

export const findCampOr404 = async (id) => {
  const camp = await findCampById(id);
  if (!camp) throw new HttpError(404, "Camp not found");
  return camp;
};

/** Only the id's owner may act on it; anyone else (or a missing camp) gets the same 404. */
const ownedOr404 = async (id, organisationId) => {
  const camp = await findCampById(id);
  if (!camp || camp.organisation !== organisationId) throw new HttpError(404, "Camp not found");
  return camp;
};

/** Organisations (blood banks): registers a camp at a fixed venue, active as soon as it is created. */
export const createCamp = async (organisation, body) => {
  const now = new Date().toISOString();
  const record = {
    organisation: organisation._id,
    ...body,
    status: CAMP_STATUS.ACTIVE,
    createdAt: now,
    updatedAt: now,
  };
  const ref = await campsCollection().add(record);
  return { _id: ref.id, ...record };
};

/** Organisations: every camp they run, newest first. */
export const listMine = async (organisationId) => {
  const snap = await campsCollection().where("organisation", "==", organisationId).limit(LIMITS.MAX_SCAN).get();
  return snap.docs.map(toCamp).sort(newestFirst);
};

export const updateCamp = async (id, organisationId, patch) => {
  await ownedOr404(id, organisationId);
  await campsCollection()
    .doc(id)
    .update({ ...patch, updatedAt: new Date().toISOString() });
  return findCampById(id);
};

export const removeCamp = async (id, organisationId) => {
  const camp = await ownedOr404(id, organisationId);
  await campsCollection().doc(id).delete();
  return camp;
};

/** Every camp an admin has not suspended, for the public "nearby" map. */
export const listActiveCamps = async () => {
  const snap = await campsCollection().where("status", "==", CAMP_STATUS.ACTIVE).limit(LIMITS.MAX_SCAN).get();
  return snap.docs.map(toCamp);
};

/** Admin: every camp regardless of status, newest first. */
export const listAllCamps = async () => {
  const snap = await campsCollection().limit(LIMITS.MAX_SCAN).get();
  return snap.docs.map(toCamp).sort(newestFirst);
};

/** Admin: moderates a camp without needing to own it. */
export const setCampStatus = async (id, status) => {
  await findCampOr404(id);
  await campsCollection()
    .doc(id)
    .update({ status, updatedAt: new Date().toISOString() });
  return findCampById(id);
};

export const adminRemoveCamp = async (id) => {
  const camp = await findCampOr404(id);
  await campsCollection().doc(id).delete();
  return camp;
};
