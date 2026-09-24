/** An error whose message is safe to show to the caller. Anything else becomes a generic 500. */
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }
}
