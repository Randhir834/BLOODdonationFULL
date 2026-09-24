import { z } from "zod";
import { BLOOD_GROUPS, DISCARD_REASONS, INVENTORY_TYPE_LIST, LIMITS } from "../constants/index.js";
import { emptyToUndefined, optionalQuery, phone, text } from "./common.js";

export const createRecordBody = z.object({
  phone,
  inventoryType: z.enum(INVENTORY_TYPE_LIST, { error: "Choose whether blood is added or issued" }),
  bloodGroup: z.enum(BLOOD_GROUPS, { error: "Choose a blood group" }),
  quantity: z
    .number({ error: "Enter the amount in ML" })
    .int("Enter a whole number of ML")
    .positive("Enter the amount in ML")
    .max(LIMITS.MAX_QUANTITY_ML, `The most you can record at once is ${LIMITS.MAX_QUANTITY_ML} ML`),
});

export const discardUnitBody = z.object({
  reason: z.enum(DISCARD_REASONS, { error: "Choose a reason" }),
  note: text(LIMITS.DISCARD_NOTE, "Note").default(""),
});

export const overviewQuery = z.object({
  recent: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(50).default(5)),
});

export const myRecordsQuery = z.object({
  type: optionalQuery(z.enum(INVENTORY_TYPE_LIST)),
  bloodGroup: optionalQuery(z.enum(BLOOD_GROUPS)),
});
