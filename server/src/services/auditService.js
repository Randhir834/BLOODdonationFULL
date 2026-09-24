import { logger } from "../utils/logger.js";
import { auditLogsCollection } from "./collections.js";
import { displayName } from "./userService.js";

// `actorType` says who acted: an "admin" on the admin website, or a "user" (blood bank, hospital or donor)
// in the mobile app. Older entries have no `actorType` and were all written by admins.
const write = async (actor, action, target = {}, details = {}) => {
  try {
    await auditLogsCollection().add({
      at: new Date().toISOString(),
      ...actor,
      action,
      targetType: target.type || null,
      targetId: target.id || null,
      targetLabel: target.label || null,
      details,
    });
  } catch (err) {
    logger.error({ err, action }, "Audit log write failed");
  }
};

/** Remembers who did what in the admin panel. A failed write is logged but never blocks the admin. */
export const record = (admin, action, target, details) =>
  write(
    {
      actorType: "admin",
      actorId: admin.uid,
      actorLabel: admin.email,
      actorRole: null,
      adminUid: admin.uid,
      adminEmail: admin.email,
    },
    action,
    target,
    details
  );

/**
 * Remembers what a blood bank, hospital or donor did in the app (signing up, adding or issuing blood).
 * `user` is the profile of the person acting. A failed write is logged but never blocks them.
 */
export const recordActivity = (user, action, target, details) =>
  write(
    {
      actorType: "user",
      actorId: user._id,
      actorLabel: displayName(user),
      actorRole: user.role,
    },
    action,
    target,
    details
  );

export const list = async (limit = 100) => {
  const snap = await auditLogsCollection().orderBy("at", "desc").limit(limit).get();
  return snap.docs.map((doc) => ({ _id: doc.id, ...doc.data() }));
};
