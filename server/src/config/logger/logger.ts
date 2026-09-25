import { pino } from "pino";
import { env } from "../env/env.js";

/**
 * Structured JSON logs in every environment except local development, where
 * pino-pretty makes them readable. Credentials are redacted at the logger, so
 * a careless `logger.info({ req })` can never write a cookie or token to disk.
 */
export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : env.LOG_LEVEL,
  base: { service: "crm-api" },
  redact: {
    paths: [
      "req.headers.cookie",
      "req.headers.authorization",
      // The custom header's value is a shared secret (its name is validated
      // as [a-z0-9-] in env.ts, so it is safe to place in a redact path).
      `req.headers["${env.CUSTOM_HEADER_NAME}"]`,
      'res.headers["set-cookie"]',
      "*.password",
      "*.pass",
      "*.auth.pass",
      "*.passwordHash",
      "*.token",
      "*.accessToken",
      "*.refreshToken",
    ],
    censor: "[redacted]",
  },
  ...(env.NODE_ENV === "development"
    ? { transport: { target: "pino-pretty", options: { translateTime: "SYS:HH:MM:ss" } } }
    : {}),
});

export type Logger = typeof logger;
