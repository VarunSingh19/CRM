import express, { type Express } from "express";
import { env } from "./config/env/env.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler/errorHandler.js";
import { requestLogger } from "./middlewares/requestLogger/requestLogger.js";
import { corsPolicy, securityHeaders } from "./middlewares/security/security.js";
import { type RouteOptions, registerRoutes } from "./routes/index.js";

/**
 * Builds the app without listening, so a test can drive it with supertest.
 * server.ts owns the process (port, signals, shutdown).
 */
export function createApp(options: RouteOptions = {}): Express {
  const app = express();

  // req.ip is the client, not the proxy, only if this matches the real hops.
  app.set("trust proxy", env.TRUST_PROXY);
  // Express 5's default, stated explicitly: no nested objects from the query
  // string, so `?x[$ne]=1` is a literal key and never a MongoDB operator.
  app.set("query parser", "simple");

  app.use(requestLogger);
  app.use(securityHeaders);
  app.use(corsPolicy);
  // Body and cookie parsing happen inside /api, after its rate limit and
  // origin check (routes/index.ts), so a malformed body is counted, not free.

  registerRoutes(app, options);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
