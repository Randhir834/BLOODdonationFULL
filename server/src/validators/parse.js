import { HttpError } from "../utils/HttpError.js";

/**
 * Parses `data` with a zod schema and returns the cleaned value.
 * Throws a 400 whose message is the first problem, with every problem in `details.errors`.
 */
export const parse = (schema, data) => {
  const result = schema.safeParse(data ?? {});
  if (result.success) return result.data;

  const errors = result.error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));
  throw new HttpError(400, errors[0].message, { errors });
};
