import type { RequestHandler } from "express";
import { createApp } from "./app.js";
import { connectDatabase } from "./config/database/database.js";
import { env } from "./config/env/env.js";
import { logger } from "./config/logger/logger.js";
import { checkSmtp } from "./config/smtp/smtp.js";

/**
 * The app for a serverless host (Vercel, through index.js at the package
 * root). The platform owns the port, the process and its shutdown, so there
 * is no listen() and no signal handling here; server.ts does that for a
 * long-running process. Each instance connects to the database on its first
 * request and keeps the connection for the requests after it.
 */
export const app = createApp();

let starting: Promise<void> | null = null;

function start(): Promise<void> {
  starting ??= connectDatabase().then(
    () => {
      // Email isn't waited for: the check never throws, and a cold start
      // shouldn't pay for an SMTP sign-in (/health shows the result).
      void checkSmtp();
      if (!env.SMTP_HOST) logger.info("email is OFF (SMTP_HOST is empty); emails are skipped, not sent");
      if (!env.CUSTOM_HEADER_ENABLED) {
        const level = env.NODE_ENV === "production" ? "warn" : "info";
        logger[level]({ header: env.CUSTOM_HEADER_NAME }, "custom header check is OFF (CUSTOM_HEADER_ENABLED=false)");
      }
    },
    (err: unknown) => {
      // Not kept: the next request tries again instead of failing forever.
      starting = null;
      // connectDatabase() has already removed credentials from its message.
      logger.error({ err: { name: (err as Error).name, message: (err as Error).message } }, "failed to start");
      throw err;
    },
  );
  return starting;
}

/**
 * Holds each request until the database is connected, as server.ts doesn't
 * listen before it is. While it can't connect, requests get a 503 and the
 * next one tries again.
 */
export const untilStarted: RequestHandler = async (_req, res, next) => {
  try {
    await start();
  } catch {
    res.status(503).json({ error: "Service unavailable. Please try again shortly.", code: "SERVICE_UNAVAILABLE" });
    return;
  }
  next();
};
