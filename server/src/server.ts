import { createApp } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/database/database.js";
import { env } from "./config/env/env.js";
import { logger } from "./config/logger/logger.js";
import { checkSmtp, closeSmtp } from "./config/smtp/smtp.js";
import { markDraining } from "./utils/lifecycle/lifecycle.js";

/** How long in-flight requests get to finish, once the listener closes, before exit. */
const SHUTDOWN_GRACE_MS = 10_000;

// Crash loudly and let the supervisor (Docker, systemd, PM2) restart a clean
// process — state after an unexpected throw cannot be trusted.
process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: reason }, "unhandled promise rejection");
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "uncaught exception");
  process.exit(1);
});

async function main(): Promise<void> {
  // Connect first: a process that cannot reach its database must not take
  // traffic. The email relay is checked alongside it; that check never
  // throws, since the API still works while email is down (/health says so).
  await Promise.all([connectDatabase(), checkSmtp()]);

  if (!env.SMTP_HOST) logger.info("email is OFF (SMTP_HOST is empty); emails are skipped, not sent");
  if (!env.CUSTOM_HEADER_ENABLED) {
    const level = env.NODE_ENV === "production" ? "warn" : "info";
    logger[level]({ header: env.CUSTOM_HEADER_NAME }, "custom header check is OFF (CUSTOM_HEADER_ENABLED=false)");
  }

  const server = createApp().listen(env.PORT, () => {
    logger.info(
      {
        port: env.PORT,
        env: env.NODE_ENV,
        docs: env.SWAGGER_ENABLED ? `http://localhost:${env.PORT}/api-docs` : "off",
      },
      "server listening",
    );
  });

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    // /ready turns 503 now; the listener stays open for SHUTDOWN_DELAY_MS so a
    // load balancer notices and stops routing here before connections are refused.
    markDraining();
    logger.info({ signal, delayMs: env.SHUTDOWN_DELAY_MS }, "shutting down");

    const force = setTimeout(() => {
      logger.error({ graceMs: SHUTDOWN_GRACE_MS }, "requests still open after grace period; forcing exit");
      process.exit(1);
    }, env.SHUTDOWN_DELAY_MS + SHUTDOWN_GRACE_MS);
    force.unref();

    setTimeout(() => {
      // Stop accepting connections, let in-flight requests finish, then close
      // the database and the email pool — in that order, so no request loses
      // its connection.
      server.close(async (err) => {
        try {
          await disconnectDatabase();
        } catch (dbErr) {
          logger.error({ err: dbErr }, "error closing the database connection");
        }
        closeSmtp();
        clearTimeout(force);
        logger.info("shutdown complete");
        process.exit(err ? 1 : 0);
      });
      // Idle keep-alive sockets would otherwise hold close() open until they time out.
      server.closeIdleConnections();
    }, env.SHUTDOWN_DELAY_MS);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err: unknown) => {
  // connectDatabase() has already removed credentials from its message.
  logger.fatal({ err: { name: (err as Error).name, message: (err as Error).message } }, "failed to start");
  process.exit(1);
});
