import mongoose, { type ConnectOptions } from "mongoose";
import { isDraining } from "../../utils/lifecycle/lifecycle.js";
import { env } from "../env/env.js";
import { logger } from "../logger/logger.js";

/**
 * Where the connection points, for logs: hosts and database name only. The
 * URI can carry a password, so it is never logged as a whole.
 */
export function describeUri(uri: string): { hosts: string; database: string } {
  const match = /^mongodb(?:\+srv)?:\/\/(?:[^@/?#]*@)?([^/?#]+)(?:\/([^?#]*))?/.exec(uri);
  return { hosts: match?.[1] ?? "unknown", database: match?.[2] || "(default)" };
}

/** Error text with any credentials removed, in case a driver message quotes the URI. */
export function scrub(text: string): string {
  let out = text.replace(/(mongodb(?:\+srv)?:\/\/)[^@/\s]+@/g, "$1***@");
  if (env.MONGODB_PASSWORD) out = out.split(env.MONGODB_PASSWORD).join("***");
  return out;
}

/**
 * How this app connects. Options passed here override the same options in the
 * URI, so the security settings cannot be switched off from the connection
 * string alone.
 */
export function connectionOptions(): ConnectOptions {
  return {
    appName: env.MONGODB_APP_NAME,

    // Encryption in transit. Certificates and hostnames are always checked
    // (Node's TLS defaults: TLS 1.2 or newer, verified against the CA).
    tls: env.MONGODB_TLS,
    tlsAllowInvalidCertificates: false,
    tlsAllowInvalidHostnames: false,
    ...(env.MONGODB_TLS_CA_FILE ? { tlsCAFile: env.MONGODB_TLS_CA_FILE } : {}),
    ...(env.MONGODB_TLS_CERT_KEY_FILE
      ? {
          tlsCertificateKeyFile: env.MONGODB_TLS_CERT_KEY_FILE,
          ...(env.MONGODB_TLS_CERT_KEY_PASSWORD
            ? { tlsCertificateKeyFilePassword: env.MONGODB_TLS_CERT_KEY_PASSWORD }
            : {}),
        }
      : {}),

    // Authentication, when the credentials are kept out of the URI. The
    // driver negotiates SCRAM-SHA-256; the password never crosses the wire.
    ...(env.MONGODB_USERNAME && env.MONGODB_PASSWORD
      ? { auth: { username: env.MONGODB_USERNAME, password: env.MONGODB_PASSWORD } }
      : {}),

    // Pool. A bounded pool per process protects the database from a traffic
    // spike; a request that cannot get a connection in time fails fast with
    // an error instead of waiting forever; idle connections are recycled.
    maxPoolSize: env.MONGODB_MAX_POOL_SIZE,
    minPoolSize: env.MONGODB_MIN_POOL_SIZE,
    maxIdleTimeMS: env.MONGODB_MAX_IDLE_TIME_MS,
    waitQueueTimeoutMS: env.MONGODB_WAIT_QUEUE_TIMEOUT_MS,
    maxConnecting: 2,

    // Timeouts: find a server, and open a connection, within 10 s or fail.
    serverSelectionTimeoutMS: 10_000,
    connectTimeoutMS: 10_000,

    // Durability: retry once on a network blip; acknowledged by a majority.
    retryWrites: true,
    retryReads: true,
    writeConcern: { w: "majority" },

    // Mongoose: fail a query at once while disconnected (readiness reports
    // the outage) instead of queueing it; indexes are built by a script in
    // production, not on every boot.
    bufferCommands: false,
    autoIndex: env.NODE_ENV !== "production",
  };
}

let listenersAttached = false;

/** Logs connection health, without credentials, for the life of the process. */
function watchConnection(target: { hosts: string; database: string }): void {
  if (listenersAttached) return;
  listenersAttached = true;
  const connection = mongoose.connection;
  connection.on("disconnected", () => {
    if (!isDraining()) logger.warn(target, "database disconnected");
  });
  connection.on("reconnected", () => logger.info(target, "database reconnected"));
  connection.on("error", (err: Error) =>
    logger.error({ ...target, err: { name: err.name, message: scrub(err.message) } }, "database error"),
  );
  // A cleared pool means the driver dropped every connection after a network error.
  connection.getClient().on("connectionPoolCleared", () => logger.warn(target, "database connection pool cleared"));
}

export async function connectDatabase(): Promise<void> {
  const target = describeUri(env.MONGODB_URI);
  try {
    await mongoose.connect(env.MONGODB_URI, connectionOptions());
  } catch (err) {
    // Rethrown with the credentials removed; server.ts logs it and exits.
    throw new Error(`database connection to ${target.hosts} failed: ${scrub((err as Error).message)}`);
  }
  watchConnection(target);
  logger.info(
    {
      ...target,
      tls: env.MONGODB_TLS,
      clientCertificate: Boolean(env.MONGODB_TLS_CERT_KEY_FILE),
      pool: { max: env.MONGODB_MAX_POOL_SIZE, min: env.MONGODB_MIN_POOL_SIZE },
    },
    "database connected",
  );
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export interface DatabaseCheck {
  status: "up" | "down";
  /** Round-trip time of the ping, when it answered. */
  latencyMs?: number;
}

/** A probe must answer quickly: a ping slower than this counts as down. */
const PING_TIMEOUT_MS = 2_000;
/** A result is reused this long, so a burst of probes costs one round trip. */
const PING_CACHE_MS = 2_000;

let lastPing: { at: number; result: DatabaseCheck } | null = null;
let inflightPing: Promise<DatabaseCheck> | null = null;

async function runPing(): Promise<{ result: DatabaseCheck; reason?: string }> {
  const db = mongoose.connection.db;
  if (!db || mongoose.connection.readyState !== mongoose.ConnectionStates.connected) {
    return { result: { status: "down" }, reason: "not connected" };
  }
  const started = performance.now();
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      db.command({ ping: 1 }),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`no answer within ${PING_TIMEOUT_MS} ms`)), PING_TIMEOUT_MS);
      }),
    ]);
    return { result: { status: "up", latencyMs: Math.round(performance.now() - started) } };
  } catch (err) {
    return { result: { status: "down" }, reason: scrub((err as Error).message) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * A real round trip to the database (the `ping` command), not just the
 * driver's connection flag: it also catches a server that stopped answering
 * while the socket still looks open. Concurrent callers share one ping and
 * a result is reused for PING_CACHE_MS, so hammering /health can't load the
 * database. Never throws.
 */
export function pingDatabase(): Promise<DatabaseCheck> {
  if (lastPing && Date.now() - lastPing.at < PING_CACHE_MS) return Promise.resolve(lastPing.result);
  inflightPing ??= runPing()
    .then(({ result, reason }) => {
      // Log changes only, so a long outage is one line, not one per probe.
      const target = describeUri(env.MONGODB_URI);
      if (result.status === "down" && lastPing?.result.status !== "down") {
        logger.error({ ...target, reason }, "database not answering; /health and /ready report down");
      } else if (result.status === "up" && lastPing?.result.status === "down") {
        logger.info(target, "database answering again");
      }
      lastPing = { at: Date.now(), result };
      return result;
    })
    .finally(() => {
      inflightPing = null;
    });
  return inflightPing;
}
