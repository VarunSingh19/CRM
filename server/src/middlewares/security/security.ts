import cors from "cors";
import type { RequestHandler } from "express";
import helmet from "helmet";
import { env } from "../../config/env/env.js";

/**
 * Security headers (helmet's defaults): a same-origin Content-Security-Policy,
 * HSTS, nosniff, no framing by other sites, and no X-Powered-By. Swagger UI
 * runs within that policy, since it loads its scripts from this origin.
 *
 * `upgrade-insecure-requests` is kept for production (HTTPS) only. On plain
 * HTTP in development it would make browsers fetch this server's own assets
 * (Swagger UI's scripts and styles) over HTTPS, which does not exist there.
 */
export const securityHeaders: RequestHandler = helmet({
  contentSecurityPolicy: {
    directives: { upgradeInsecureRequests: env.NODE_ENV === "production" ? [] : null },
  },
});

/**
 * Credentialed CORS for the listed frontend origins only; with none listed,
 * no CORS headers are sent at all. The paging total and the request id are
 * readable by a cross-origin frontend too.
 */
export const corsPolicy: RequestHandler = cors({
  origin: env.ALLOWED_ORIGINS.length ? env.ALLOWED_ORIGINS : false,
  credentials: true,
  exposedHeaders: ["X-Total-Count", "X-Request-Id"],
});

/** API responses are per-user: no browser or proxy may cache them. */
export const noStore: RequestHandler = (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
};
