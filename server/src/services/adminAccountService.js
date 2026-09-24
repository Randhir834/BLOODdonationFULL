import { getAdminAuth, getDb } from "../config/firebase.js";
import { HttpError } from "../utils/HttpError.js";
import { createAdminBody } from "../validators/admin.validator.js";
import { parse } from "../validators/parse.js";
import { adminsCollection } from "./collections.js";

// The login itself is a Firebase email + password account carrying an `admin` claim.
// The `admins` collection is only an index of those accounts, for listing.

export const createAdminAccount = async (input, createdBy = "system") => {
  const { email, password, name } = parse(createAdminBody, input);

  const auth = getAdminAuth();
  const exists = await auth
    .getUserByEmail(email)
    .then(() => true)
    .catch((error) => {
      if (error.code === "auth/user-not-found") return false;
      throw error;
    });
  if (exists) throw new HttpError(409, "An account with this email already exists");

  const created = await auth.createUser({
    email,
    password,
    displayName: name || undefined,
    emailVerified: true,
  });
  await auth.setCustomUserClaims(created.uid, { admin: true });

  const record = { email, name, createdAt: new Date().toISOString(), createdBy };
  await adminsCollection().doc(created.uid).set(record);
  return { _id: created.uid, ...record };
};

export const listAdminAccounts = async () => {
  const snap = await adminsCollection().get();
  return snap.docs
    .map((doc) => ({ _id: doc.id, ...doc.data() }))
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
};

/**
 * The "at least one admin must remain" check and the index-doc delete happen inside one Firestore
 * transaction, re-counting fresh each time, so two admins removing each other at the same moment can
 * not both succeed and leave zero admins: only the first commits, the second re-reads the now-lower
 * count and fails with "the last admin can not be removed".
 */
export const removeAdminAccount = async (uid, actingUid) => {
  if (uid === actingUid) throw new HttpError(400, "You can not remove your own account");

  const target = await getDb().runTransaction(async (tx) => {
    const snap = await tx.get(adminsCollection());
    const targetDoc = snap.docs.find((doc) => doc.id === uid);
    if (!targetDoc) throw new HttpError(404, "Admin not found");
    if (snap.size <= 1) throw new HttpError(400, "The last admin can not be removed");
    tx.delete(targetDoc.ref);
    return { _id: targetDoc.id, ...targetDoc.data() };
  });

  try {
    await getAdminAuth().deleteUser(uid);
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
  }
  return target;
};
