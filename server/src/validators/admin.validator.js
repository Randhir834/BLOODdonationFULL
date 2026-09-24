import { z } from "zod";
import {
  BLOOD_GROUPS,
  INVENTORY_TYPE_LIST,
  LIMITS,
  REQUEST_STATUS_LIST,
  ROLE_LIST,
  UNIT_STATUS,
  USER_STATUS,
  VERIFICATION_LIST,
} from "../constants/index.js";
import { dayKey, docId, emptyToUndefined, optionalQuery, pagination, searchText, text } from "./common.js";

export const dashboardQuery = z.object({
  fresh: optionalQuery(z.enum(["1", "true"])),
});

export const auditLogsQuery = z.object({
  limit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(300).default(100)),
});

export const listUsersQuery = z.object({
  role: optionalQuery(z.enum(ROLE_LIST)),
  status: optionalQuery(z.enum(Object.values(USER_STATUS))),
  verification: optionalQuery(z.enum(VERIFICATION_LIST)),
  q: searchText,
  ...pagination,
});

export const updateUserBody = z.object({
  role: z.enum(ROLE_LIST, { error: "Invalid role" }).optional(),
  name: text(LIMITS.NAME, "Name").optional(),
  address: text(LIMITS.ADDRESS, "Address").optional(),
  website: text(LIMITS.WEBSITE, "Website").optional(),
  bloodGroup: z.enum(BLOOD_GROUPS, { error: "Choose a blood group" }).optional(),
});

export const suspendUserBody = z.object({
  reason: text(LIMITS.REASON, "Reason").min(1, "Please give a reason"),
});

export const rejectUserBody = z.object({
  reason: text(LIMITS.REASON, "Reason").min(1, "Please give a reason"),
});

export const listInventoryQuery = z.object({
  type: optionalQuery(z.enum(INVENTORY_TYPE_LIST)),
  bloodGroup: optionalQuery(z.enum(BLOOD_GROUPS)),
  organisation: optionalQuery(docId),
  from: optionalQuery(dayKey),
  to: optionalQuery(dayKey),
  q: searchText,
  // "expired" is not a stored status: it means status is still "available" but the expiry date has passed.
  status: optionalQuery(z.enum([...Object.values(UNIT_STATUS), "expired"])),
  sort: optionalQuery(z.enum(["newest", "expiry"])).default("newest"),
  ...pagination,
});

export const listRequestsQuery = z.object({
  status: optionalQuery(z.enum(REQUEST_STATUS_LIST)),
  role: optionalQuery(z.enum(ROLE_LIST)),
  bloodGroup: optionalQuery(z.enum(BLOOD_GROUPS)),
  organisation: optionalQuery(docId),
  q: searchText,
  ...pagination,
});

export const createAdminBody = z.object({
  email: z.string({ error: "Enter a valid email" }).trim().toLowerCase().pipe(z.email("Enter a valid email")),
  password: z
    .string({ error: "Enter a password" })
    .min(LIMITS.MIN_ADMIN_PASSWORD, `Password must be at least ${LIMITS.MIN_ADMIN_PASSWORD} characters`)
    .max(128, "Password is too long"),
  name: text(LIMITS.NAME, "Name").default(""),
});
