import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError } from "../../utils/errors/AppError.js";

/**
 * Every failure has one shape: a human-readable `error` the UI can show as-is,
 * a stable `code` for the client to branch on, the `requestId` that finds the
 * log line, and `details` listing every field problem on a validation error.
 */
interface ErrorBody {
  error: string;
  code: string;
  requestId?: string;
  details?: ReadonlyArray<{ path: string; message: string }>;
}

/** body-parser errors carry an `expose`-safe `type` and a `status`. */
function fromBodyParser(err: unknown): AppError | null {
  const e = err as { type?: unknown; status?: unknown };
  if (typeof e?.type !== "string" || typeof e.status !== "number") return null;
  if (e.type === "entity.parse.failed") return new AppError(400, "INVALID_JSON", "Request body is not valid JSON");
  if (e.type === "entity.too.large") return new AppError(413, "PAYLOAD_TOO_LARGE", "Request body is too large");
  return new AppError(e.status >= 400 && e.status < 500 ? e.status : 400, "BAD_REQUEST", "Malformed request");
}

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError(404, "ROUTE_NOT_FOUND", "Not found"));
};

/**
 * The last middleware. Express 5 forwards rejected promises here, so
 * controllers just `throw` — no try/catch, no asyncHandler wrapper.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  // Too late to send a JSON error; let Express close the connection.
  if (res.headersSent) return next(err);

  const known = err instanceof AppError ? err : fromBodyParser(err);
  if (!known) {
    // A bug or an infrastructure failure. Full detail goes to the log only;
    // the client never sees stack traces, driver messages or internals.
    req.log.error({ err }, "unhandled error");
  }
  const appErr = known ?? new AppError(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");

  const body: ErrorBody = {
    error: appErr.message,
    code: appErr.code,
    ...(req.id ? { requestId: String(req.id) } : {}),
    ...(appErr.details ? { details: appErr.details } : {}),
  };
  res.status(appErr.status).json(body);
};
