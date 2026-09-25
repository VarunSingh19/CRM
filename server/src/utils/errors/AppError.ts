/**
 * An error the client is allowed to see. Anything thrown that is NOT an
 * AppError is treated as a bug: logged in full, answered with a generic 500.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: ReadonlyArray<{ path: string; message: string }>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to do that.") {
    super(403, "FORBIDDEN", message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(code: string, message: string) {
    super(404, code, message);
    this.name = "NotFoundError";
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "Not authenticated") {
    super(401, "UNAUTHENTICATED", message);
    this.name = "UnauthenticatedError";
  }
}
