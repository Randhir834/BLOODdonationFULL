import { z } from "zod";
import { APPROVAL_ROLES, BLOOD_GROUPS, LIMITS, ROLE_LIST } from "../constants/index.js";
import { phone, text } from "./common.js";

export const phoneLoginBody = z.object({ phone });

export const registerBody = z
  .object({
    role: z.enum(ROLE_LIST, { error: "Choose how you will use Blood Bank" }),
    name: text(LIMITS.NAME, "Name").min(1, "Name is required"),
    address: text(LIMITS.ADDRESS, "Address").min(1, "Address is required"),
    // The city a blood request raised by this account is broadcast to (see requestService.createRequest).
    city: text(LIMITS.CITY, "City").min(1, "City is required"),
    website: text(LIMITS.WEBSITE, "Website").default(""),
    registrationNumber: text(LIMITS.REGISTRATION_NUMBER, "Registration number").default(""),
    // A donor's own blood type, optional: it only ever narrows which blood requests notify them.
    bloodGroup: z.enum(BLOOD_GROUPS, { error: "Choose a blood group" }).optional(),
  })
  // The number is what an admin checks before approving a hospital or blood bank.
  .refine((body) => !APPROVAL_ROLES.includes(body.role) || body.registrationNumber, {
    message: "Registration number is required",
    path: ["registrationNumber"],
  });

// PATCH /auth/me: the signed-in user corrects their own address/city, e.g. an account created before
// `city` existed, so it can start appearing in the nearby-requests feed (requestService.listNearbyRequests).
export const updateProfileBody = z.object({
  address: text(LIMITS.ADDRESS, "Address").min(1, "Address is required"),
  city: text(LIMITS.CITY, "City").min(1, "City is required"),
});
