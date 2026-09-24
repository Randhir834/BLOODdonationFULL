import { z } from "zod";
import {
  BLOOD_GROUPS,
  LIMITS,
  REQUEST_COMPONENT_LIST,
  REQUEST_PRIORITY_LIST,
  REQUEST_STATUS_LIST,
} from "../constants/index.js";
import { docId, idParams, optionalDateTime, optionalQuery, text } from "./common.js";

export const createRequestBody = z.object({
  // Kept accepting a target blood bank for back-compat, but it is no longer asked for on the create
  // form: a request now broadcasts to the requester's city (see requestService.createRequest) instead.
  organisation: docId.optional(),
  patientName: text(LIMITS.PATIENT_NAME, "Patient name").min(1, "Enter the patient's name"),
  bloodGroup: z.enum(BLOOD_GROUPS, { error: "Choose a blood group" }),
  component: z.enum(REQUEST_COMPONENT_LIST, { error: "Choose a component" }).default("whole_blood"),
  quantity: z
    .number({ error: "Enter the amount in ML" })
    .int("Enter a whole number of ML")
    .positive("Enter the amount in ML")
    .max(LIMITS.MAX_QUANTITY_ML, `The most you can request at once is ${LIMITS.MAX_QUANTITY_ML} ML`),
  priority: z.enum(REQUEST_PRIORITY_LIST, { error: "Choose a priority" }).default("normal"),
  requiredAt: optionalDateTime,
  location: text(LIMITS.ADDRESS, "Hospital / location").min(1, "Enter the hospital or location"),
  contactName: text(LIMITS.CONTACT_NAME, "Contact name").default(""),
  contactPhone: text(LIMITS.CONTACT_PHONE, "Contact phone").default(""),
  note: text(LIMITS.REQUEST_NOTE, "Note").default(""),
});

// A field left out keeps its current value: the requester only sends what they actually changed.
// The blood group, component and priority always come as a real choice from a fixed list, so those are
// sent whenever the form is submitted; every free-text and the quantity field is optional. The target
// blood bank is not editable (like requesterPhone/city, it is fixed at creation).
export const updateRequestBody = z.object({
  bloodGroup: z.enum(BLOOD_GROUPS, { error: "Choose a blood group" }),
  component: z.enum(REQUEST_COMPONENT_LIST, { error: "Choose a component" }),
  priority: z.enum(REQUEST_PRIORITY_LIST, { error: "Choose a priority" }),
  patientName: text(LIMITS.PATIENT_NAME, "Patient name").min(1, "Enter the patient's name").optional(),
  quantity: z
    .number({ error: "Enter the amount in ML" })
    .int("Enter a whole number of ML")
    .positive("Enter the amount in ML")
    .max(LIMITS.MAX_QUANTITY_ML, `The most you can request at once is ${LIMITS.MAX_QUANTITY_ML} ML`)
    .optional(),
  requiredAt: optionalDateTime,
  location: text(LIMITS.ADDRESS, "Hospital / location").min(1, "Enter the hospital or location").optional(),
  contactName: text(LIMITS.CONTACT_NAME, "Contact name").optional(),
  contactPhone: text(LIMITS.CONTACT_PHONE, "Contact phone").optional(),
  note: text(LIMITS.REQUEST_NOTE, "Note").optional(),
});

export const rejectRequestBody = z.object({
  reason: text(LIMITS.REASON, "Reason").min(1, "Please give a reason"),
});

export const listRequestsQuery = z.object({
  status: optionalQuery(z.enum(REQUEST_STATUS_LIST)),
});

export const responseParams = idParams.extend({ responseId: docId });

export const respondToRequestBody = z.object({
  unitsOffered: z
    .number({ error: "Enter how many units you can give" })
    .int("Enter a whole number of units")
    .positive("Enter how many units you can give")
    .max(LIMITS.MAX_UNITS_OFFERED, `The most you can offer at once is ${LIMITS.MAX_UNITS_OFFERED} units`)
    .default(1),
});
