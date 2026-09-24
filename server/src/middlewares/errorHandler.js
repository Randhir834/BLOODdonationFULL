import { HttpError } from "../utils/HttpError.js";
import { logger } from "../utils/logger.js";

export const notFound = (_req, _res, next) => next(new HttpError(404, "Route not found"));

// Errors raised by express itself and by body-parser carry a 4xx `status` and are safe to report.
const clientStatus = (error) =>
  Number.isInteger(error.status) && error.status >= 400 && error.status < 500 ? error.status : null;

/** Last resort: every error becomes `{ success: false, message }`. Internals are logged, never sent. */
// eslint-disable-next-line no-unused-vars -- express identifies error handlers by their four arguments
export const errorHandler = (error, req, res, next) => {
  const status = clientStatus(error);

  if (!status) {
    (req.log ?? logger).error({ err: error }, "Unhandled error");
    return res.status(500).json({ success: false, message: "Something went wrong", requestId: req.id });
  }

  const message = error.type === "entity.parse.failed" ? "The request body is not valid JSON" : error.message;
  res.status(status).json({
    success: false,
    message,
    ...(error.details?.errors && { errors: error.details.errors }),
  });
};
