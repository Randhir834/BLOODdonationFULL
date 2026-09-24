import { parse } from "../validators/parse.js";

/**
 * Validates and cleans parts of the request with zod schemas: validate({ body, query, params }).
 * The cleaned values are on `req.validated`, controllers never read raw request data.
 */
export const validate = (schemas) => (req, _res, next) => {
  req.validated = {};
  for (const part of ["params", "query", "body"]) {
    if (schemas[part]) req.validated[part] = parse(schemas[part], req[part]);
  }
  next();
};
