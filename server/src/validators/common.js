import { z } from "zod";
import { LIMITS } from "../constants/index.js";

/** Query strings send an empty value for an unset filter, treat it as missing. */
export const emptyToUndefined = (value) => (value === "" ? undefined : value);

export const optionalQuery = (schema) => z.preprocess(emptyToUndefined, schema.optional());

/** A Firestore document id (or Firebase uid). It must not contain "/", which would change the path. */
export const docId = z
  .string({ error: "Invalid id" })
  .min(1, "Invalid id")
  .max(128, "Invalid id")
  .regex(/^[^/]+$/, "Invalid id");

export const idParams = z.object({ id: docId });

/** International format with country code, e.g. +919876543210. */
export const phone = z
  .string({ error: "Enter the phone number with country code, e.g. +919876543210" })
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, "Enter the phone number with country code, e.g. +919876543210");

/** Free text that is trimmed and length limited. */
export const text = (max, label = "Value") =>
  z
    .string({ error: `${label} must be text` })
    .trim()
    .max(max, `${label} is too long`);

export const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD");

/** A date-time the client sends as a plain "YYYY-MM-DDTHH:mm" (a <input type="datetime-local">) or full ISO string. */
const dateTime = z
  .string({ error: "Enter a valid date and time" })
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid date and time");
export const optionalDateTime = z.preprocess(emptyToUndefined, dateTime.optional());

/** A GPS coordinate pair, as read from the device's geolocation API. */
export const geoPoint = z.object({
  lat: z.number({ error: "Invalid location" }).min(-90).max(90),
  lng: z.number({ error: "Invalid location" }).min(-180).max(180),
});

export const searchText = optionalQuery(text(LIMITS.SEARCH, "Search"));

export const pagination = {
  page: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).default(1)),
  pageSize: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(1).max(LIMITS.MAX_PAGE_SIZE).default(LIMITS.DEFAULT_PAGE_SIZE)
  ),
};
