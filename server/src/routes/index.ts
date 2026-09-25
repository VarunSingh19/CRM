import cookieParser from "cookie-parser";
import express, { type Express, Router } from "express";
import { env } from "../config/env/env.js";
import { loadOpenApiSpec } from "../config/swagger/swagger.js";
import { customHeaderCheck } from "../middlewares/customHeader/customHeader.js";
import { originCheck } from "../middlewares/originCheck/originCheck.js";
import { ipRateLimiter, type RateLimitOptions } from "../middlewares/rateLimiter/rateLimiter.js";
import { noStore } from "../middlewares/security/security.js";
import { createDocsRouter } from "./docs/routes.js";
import { healthRouter } from "./health/routes.js";

export interface RouteOptions {
  /** The per-address flood guard (a test can shrink it to reach the limit). */
  ipRateLimit?: RateLimitOptions;
}

/**
 * The one place every router is mounted, so the order — and therefore which
 * protections a route sits behind — is visible at a glance.
 *
 *   /health, /ready   probes: no session, no limits
 *   /api-docs         Swagger UI, only when SWAGGER_ENABLED
 *   /api/*            no-store → flood guard → custom header → origin check →
 *                     body and cookie parsing → feature routers
 */
export function registerRoutes(app: Express, options: RouteOptions = {}): void {
  app.use(healthRouter);

  if (env.SWAGGER_ENABLED) app.use("/api-docs", createDocsRouter(loadOpenApiSpec()));

  const api = Router();
  api.use(noStore);
  // The cheap refusals run first, so junk — including malformed bodies — is
  // counted and turned away before any parsing or real work.
  api.use(ipRateLimiter(options.ipRateLimit));
  // After the flood guard, so guessing the key counts as failed requests.
  api.use(customHeaderCheck);
  api.use(originCheck);
  api.use(express.json({ limit: "100kb" }));
  api.use(cookieParser());
  // Feature routers go here, one line each, e.g.
  //   api.use("/users", usersRouter);   (routes/users/routes.ts)
  app.use("/api", api);
}
