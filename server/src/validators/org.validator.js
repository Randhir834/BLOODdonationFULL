import { z } from "zod";
import {
  BLOOD_GROUPS,
  DISCARD_REASONS,
  LIMITS,
  ORG_LIMITS,
  REQUEST_PRIORITY_LIST,
  REQUEST_STATUS_LIST,
} from "../constants/index.js";
import {
  dayKey,
  docId,
  emptyToUndefined,
  optionalDateTime,
  optionalQuery,
  pagination,
  phone,
  searchText,
  text,
} from "./common.js";

const ORG_ROLES = ["hospital", "organisation"];

const quantity = (what) =>
  z
    .number({ error: "Enter the amount in ML" })
    .int("Enter a whole number of ML")
    .positive("Enter the amount in ML")
    .max(LIMITS.MAX_QUANTITY_ML, `The most you can ${what} at once is ${LIMITS.MAX_QUANTITY_ML} ML`);

const bloodGroup = z.enum(BLOOD_GROUPS, { error: "Choose a blood group" });

/** An optional phone number in international format; an empty string means "none". */
const optionalPhone = z.preprocess(emptyToUndefined, phone.optional());
/** A phone number, or an empty string to clear it. */
const phoneOrEmpty = z.union([z.literal(""), phone]);
/** An email address, or an empty string to clear it. */
const emailOrEmpty = z.union([
  z.literal(""),
  z
    .string({ error: "Enter a valid email" })
    .trim()
    .toLowerCase()
    .max(ORG_LIMITS.EMAIL, "Email is too long")
    .pipe(z.email("Enter a valid email")),
]);

const profileFields = {
  address: text(LIMITS.ADDRESS, "Address").min(1, "Address is required"),
  city: text(LIMITS.CITY, "City").min(1, "City is required"),
  state: text(ORG_LIMITS.STATE, "State"),
  pincode: text(ORG_LIMITS.PINCODE, "PIN code"),
  website: text(LIMITS.WEBSITE, "Website"),
  email: emailOrEmpty,
  contactPerson: text(LIMITS.CONTACT_NAME, "Contact person"),
  alternatePhone: phoneOrEmpty,
  emergencyPhone: phoneOrEmpty,
  about: text(ORG_LIMITS.ABOUT, "About"),
  hours: text(ORG_LIMITS.HOURS, "Opening hours"),
  open24x7: z.boolean({ error: "Choose yes or no" }),
};

/** POST /org/auth/register: a hospital or blood bank creates its account after verifying its phone number. */
export const orgRegisterBody = z.object({
  role: z.enum(ORG_ROLES, { error: "Choose hospital or blood bank" }),
  name: text(LIMITS.NAME, "Name").min(1, "Name is required"),
  registrationNumber: text(LIMITS.REGISTRATION_NUMBER, "Registration number").min(
    1,
    "Registration number is required"
  ),
  address: profileFields.address,
  city: profileFields.city,
  state: profileFields.state.default(""),
  pincode: profileFields.pincode.default(""),
  website: profileFields.website.default(""),
  email: profileFields.email.default(""),
  contactPerson: profileFields.contactPerson.default(""),
  alternatePhone: profileFields.alternatePhone.default(""),
  emergencyPhone: profileFields.emergencyPhone.default(""),
  about: profileFields.about.default(""),
  hours: profileFields.hours.default(""),
  open24x7: profileFields.open24x7.default(false),
});

/** PATCH /org/profile: whatever is sent is changed, what is left out stays. */
export const orgProfileBody = z
  .object({
    name: text(LIMITS.NAME, "Name").min(1, "Name is required"),
    registrationNumber: text(LIMITS.REGISTRATION_NUMBER, "Registration number").min(
      1,
      "Registration number is required"
    ),
    ...profileFields,
  })
  .partial()
  .refine((body) => Object.values(body).some((value) => value !== undefined), "Nothing to change");

const dateOnlyToEndOfDay = (value) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59.999Z` : value);
/** A date (YYYY-MM-DD, meaning the end of that day) or a full date-time. */
const dateOrDateTime = z.preprocess(
  (value) => (typeof value === "string" ? dateOnlyToEndOfDay(emptyToUndefined(value.trim())) : value),
  z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid date")
    .optional()
);

const unitDetails = {
  collectedAt: optionalDateTime,
  expiresAt: dateOrDateTime,
  bagNumber: text(ORG_LIMITS.BAG_NUMBER, "Bag number").default(""),
  storageLocation: text(ORG_LIMITS.STORAGE, "Storage location").default(""),
  note: text(ORG_LIMITS.UNIT_NOTE, "Note").default(""),
};

/** POST /org/stock/receive: blood coming in (a donation for a blood bank, a delivery for a hospital). */
export const receiveStockBody = z
  .object({
    bloodGroup,
    quantity: quantity("record"),
    // A donor who has an account in the app is found by phone number, anyone else is just named.
    sourcePhone: optionalPhone,
    sourceName: text(LIMITS.NAME, "Name").default(""),
    ...unitDetails,
  })
  .refine((body) => body.sourcePhone || body.sourceName, {
    message: "Enter who the blood came from",
    path: ["sourceName"],
  });

/** POST /org/stock/issue: blood going out (to a hospital or patient for a blood bank, to a patient for a hospital). */
export const issueStockBody = z
  .object({
    bloodGroup,
    quantity: quantity("issue"),
    recipientPhone: optionalPhone,
    recipientName: text(LIMITS.NAME, "Name").default(""),
    reference: text(ORG_LIMITS.REFERENCE, "Reference").default(""),
    note: text(ORG_LIMITS.UNIT_NOTE, "Note").default(""),
  })
  .refine((body) => body.recipientPhone || body.recipientName, {
    message: "Enter who the blood is for",
    path: ["recipientName"],
  });

/** PATCH /org/stock/units/:id */
export const updateUnitBody = z
  .object({
    bloodGroup,
    quantity: quantity("record"),
    expiresAt: dateOrDateTime,
    bagNumber: text(ORG_LIMITS.BAG_NUMBER, "Bag number"),
    storageLocation: text(ORG_LIMITS.STORAGE, "Storage location"),
    note: text(ORG_LIMITS.UNIT_NOTE, "Note"),
  })
  .partial()
  .refine((body) => Object.values(body).some((value) => value !== undefined), "Nothing to change");

export const discardBody = z.object({
  reason: z.enum(DISCARD_REASONS, { error: "Choose a reason" }),
  note: text(LIMITS.DISCARD_NOTE, "Note").default(""),
});

export const unitsQuery = z.object({
  state: optionalQuery(z.enum(["available", "issued", "discarded", "expired", "legacy"])),
  bloodGroup: optionalQuery(bloodGroup),
  q: searchText,
  expiring: optionalQuery(z.enum(["1", "true"])),
  sort: optionalQuery(z.enum(["newest", "expiry", "quantity"])).default("newest"),
  ...pagination,
});

export const movementsQuery = z.object({
  kind: optionalQuery(z.enum(["received", "issued", "discarded"])),
  bloodGroup: optionalQuery(bloodGroup),
  q: searchText,
  from: optionalQuery(dayKey),
  to: optionalQuery(dayKey),
  ...pagination,
});

export const shipmentsQuery = z.object({ status: optionalQuery(z.enum(["pending", "received"])) });

export const orgRequestsQuery = z.object({
  relation: optionalQuery(z.enum(["mine", "addressed", "city"])),
  status: optionalQuery(z.enum([...REQUEST_STATUS_LIST, "expired"])),
  bloodGroup: optionalQuery(bloodGroup),
  priority: optionalQuery(z.enum(REQUEST_PRIORITY_LIST)),
  needsAction: optionalQuery(z.enum(["1", "true"])),
  dismissed: optionalQuery(z.enum(["1", "true"])),
  sort: optionalQuery(z.enum(["newest", "priority", "needed"])).default("newest"),
  q: searchText,
  from: optionalQuery(dayKey),
  to: optionalQuery(dayKey),
  ...pagination,
});

export const offerBody = z.object({
  unitsOffered: z
    .number({ error: "Enter how many units you can give" })
    .int("Enter a whole number of units")
    .positive("Enter how many units you can give")
    .max(LIMITS.MAX_UNITS_OFFERED, `The most you can offer at once is ${LIMITS.MAX_UNITS_OFFERED} units`),
});

export const notificationsQuery = z.object({
  unread: optionalQuery(z.enum(["1", "true"])),
  limit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(100).default(30)),
});

export const notificationParams = z.object({ id: docId });

// The exports cover whatever the list they came from was showing: the same filters, without paging.
export const movementsReportQuery = movementsQuery.omit({ page: true, pageSize: true });
export const requestsReportQuery = orgRequestsQuery.omit({ page: true, pageSize: true, sort: true });

export const activityQuery = z.object({
  limit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(200).default(100)),
});
