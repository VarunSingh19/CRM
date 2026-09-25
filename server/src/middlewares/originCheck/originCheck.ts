import type { RequestHandler } from "express";
import { env } from "../../config/env/env.js";
import { AppError } from "../../utils/errors/AppError.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Cross-site request forgery defence for a cookie-authenticated API
 * (OWASP: "verifying origin with standard headers").
 *
 * Browsers attach `Origin` to every cross-origin request and to same-origin
 * non-GET fetches, and modern ones add `Sec-Fetch-Site`. So a state-changing
 * request is refused when either says it came from a site not on the
 * allowlist. A request with neither header is not from a browser page — curl,
 * or a server-side frontend forwarding the user's cookie — and there is no
 * victim browser to forge from, so it passes.
 */
export const originCheck: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.get("origin");
  if (origin !== undefined) {
    if (env.ALLOWED_ORIGINS.includes(origin)) return next();
    throw new AppError(403, "ORIGIN_REJECTED", "This request did not come from an allowed site.");
  }

  if (req.get("sec-fetch-site") === "cross-site") {
    throw new AppError(403, "ORIGIN_REJECTED", "This request did not come from an allowed site.");
  }
  next();
};
