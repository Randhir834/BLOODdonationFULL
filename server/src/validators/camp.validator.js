import { z } from "zod";
import { LIMITS } from "../constants/index.js";
import { dayKey, geoPoint, text } from "./common.js";

const dateRange = { startDate: dayKey, endDate: dayKey };

const withDateOrder = (schema) =>
  schema.refine((body) => body.endDate >= body.startDate, {
    error: "End date must be on or after the start date",
    path: ["endDate"],
  });

export const createCampBody = withDateOrder(
  z.object({
    name: text(LIMITS.CAMP_NAME, "Name").min(1, "Name is required"),
    address: text(LIMITS.ADDRESS, "Address").min(1, "Address is required"),
    description: text(LIMITS.CAMP_DESCRIPTION, "Description").default(""),
    location: geoPoint,
    ...dateRange,
  })
);

export const updateCampBody = withDateOrder(
  z.object({
    name: text(LIMITS.CAMP_NAME, "Name").min(1, "Name is required"),
    address: text(LIMITS.ADDRESS, "Address").min(1, "Address is required"),
    description: text(LIMITS.CAMP_DESCRIPTION, "Description").default(""),
    location: geoPoint,
    ...dateRange,
  })
);
