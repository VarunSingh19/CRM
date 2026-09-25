import { setTimeout as sleep } from "node:timers/promises";
import { createTransport, type SendMailOptions, type Transporter } from "nodemailer";
import type { SMTPPoolOptions, SMTPPoolSentMessageInfo } from "nodemailer/lib/smtp-pool";
import { env } from "../env/env.js";
import { logger } from "../logger/logger.js";

/**
 * Outgoing email over SMTP (Amazon SES). One pooled, encrypted connection
 * set per process, like the database. What to send lives in services/mail;
 * this file owns the connection, the send rate and the relay's health.
 */
export type SmtpStatus = "up" | "down" | "disabled";
type Mailer = Transporter<SMTPPoolSentMessageInfo>;

/** SES accepts at most 50 recipients (To + Cc + Bcc) on one message. */
export const MAX_RECIPIENTS = 50;
/** /health rechecks the relay this often: rarely while it works, sooner once it fails. */
const RECHECK_UP_MS = 5 * 60_000;
const RECHECK_DOWN_MS = 30_000;
/** Failures that mean the relay itself is unreachable or refusing us, not one bad message. */
const CONNECTION_FAILURES = new Set(["ECONNECTION", "ETIMEDOUT", "ESOCKET", "EDNS", "ETLS", "EAUTH", "ENOAUTH"]);

/** Where email goes, for logs: never the credentials. */
const target = () => ({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  tls: env.SMTP_SECURE ? "implicit" : "starttls",
});

export function smtpOptions(): SMTPPoolOptions & { pool: true } {
  return {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,

    // Encryption in transit, always. Port 465 is TLS from the first byte;
    // any other port must upgrade with STARTTLS before anything else is
    // sent — a relay (or anyone in between) that won't is refused, so the
    // password never crosses the network in plain text. Certificates and
    // host names are always verified, TLS 1.2 or newer.
    secure: env.SMTP_SECURE,
    requireTLS: !env.SMTP_SECURE,
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    ...(env.SMTP_USER && env.SMTP_PASS ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } } : {}),

    // Pool: a few reused connections instead of a handshake per email, each
    // replaced after 100 messages. The send rate is paced by deliver(), not
    // by nodemailer's rateLimit, which only checks when a connection frees
    // up and so lets a burst of up to maxConnections past the limit.
    pool: true,
    maxConnections: 3,
    maxMessages: 100,

    // Fail within seconds, not nodemailer's minutes-long defaults.
    dnsTimeout: 10_000,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,

    // Never log the SMTP conversation: it carries the AUTH exchange.
    logger: false,
    debug: false,
    // A message can never read a local file or fetch a URL as its content
    // or attachment (no file disclosure, no server-side request forgery).
    disableFileAccess: true,
    disableUrlAccess: true,
    maxRecipients: MAX_RECIPIENTS,
  };
}

let mailer: Mailer | null = null;
let state: { status: SmtpStatus; checkedAt: Date | null } = {
  status: env.SMTP_HOST ? "down" : "disabled",
  checkedAt: null,
};
let inflight: Promise<SmtpStatus> | null = null;

/** Email is switched off when SMTP_HOST is empty (allowed outside production only). */
export const isSmtpEnabled = (): boolean => Boolean(env.SMTP_HOST);

function getMailer(): Mailer | null {
  if (!env.SMTP_HOST) return null;
  mailer ??= createTransport(smtpOptions(), { from: env.FROM_EMAIL });
  return mailer;
}

/** A nodemailer error reduced to what is safe to log: no credentials, no message content. */
export function describeSmtpError(err: unknown): Record<string, unknown> {
  const e = err as { name?: unknown; code?: unknown; responseCode?: unknown; command?: unknown; message?: unknown };
  let message = String(e?.message ?? err);
  for (const secret of [env.SMTP_PASS, env.SMTP_USER]) {
    if (secret) message = message.split(secret).join("***");
  }
  return { name: e?.name, code: e?.code, responseCode: e?.responseCode, command: e?.command, message };
}

function record(status: Exclude<SmtpStatus, "disabled">, err?: unknown): SmtpStatus {
  const previous = state;
  state = { status, checkedAt: new Date() };
  // Log changes only, so a relay that stays down doesn't flood the log.
  if (previous.checkedAt === null || previous.status !== status) {
    if (status === "up") {
      logger.info({ ...target(), ratePerSec: env.SES_RATE_PER_SEC }, "smtp ready");
    } else {
      logger.error({ ...target(), err: describeSmtpError(err) }, "smtp unavailable; email cannot be sent");
    }
  }
  return status;
}

/**
 * Connects and signs in to the relay without sending anything. Never throws:
 * email isn't critical, so a failure is logged and shown on /health, and the
 * API keeps serving. Concurrent callers share one check.
 */
export function checkSmtp(): Promise<SmtpStatus> {
  const transport = getMailer();
  if (!transport) return Promise.resolve("disabled");
  inflight ??= transport
    .verify()
    .then(
      () => record("up"),
      (err: unknown) => record("down", err),
    )
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

let nextSlot = 0;

/**
 * Waits for this message's turn: sends start at most SES_RATE_PER_SEC a
 * second, evenly spaced, so a burst queues here instead of being throttled
 * (or refused) by SES.
 */
async function sendSlot(): Promise<void> {
  const now = Date.now();
  const slot = Math.max(now, nextSlot);
  nextSlot = slot + 1_000 / env.SES_RATE_PER_SEC;
  if (slot > now) await sleep(slot - now);
}

/**
 * Sends one prepared message from FROM_EMAIL, at the paced rate. The result
 * also tells /health about the relay: success means up; a connection or
 * sign-in failure means down (a rejected message says nothing about it).
 */
export async function deliver(message: SendMailOptions): Promise<SMTPPoolSentMessageInfo> {
  const transport = getMailer();
  if (!transport) throw new Error("SMTP is not configured (SMTP_HOST is empty)");
  await sendSlot();
  try {
    const info = await transport.sendMail(message);
    record("up");
    return info;
  } catch (err) {
    const code = (err as { code?: unknown })?.code;
    if (typeof code === "string" && CONNECTION_FAILURES.has(code)) record("down", err);
    throw err;
  }
}

/**
 * The last known state, for /health. It never waits on the relay: once the
 * result is stale, a fresh check starts in the background and the next
 * probe sees it. (Signing in to SES on every probe would be slow, and could
 * get the account throttled.)
 */
export function smtpHealth(): { status: SmtpStatus; checkedAt: string | null } {
  if (env.SMTP_HOST) {
    const age = state.checkedAt ? Date.now() - state.checkedAt.getTime() : Number.POSITIVE_INFINITY;
    if (age > (state.status === "up" ? RECHECK_UP_MS : RECHECK_DOWN_MS)) void checkSmtp();
  }
  return { status: state.status, checkedAt: state.checkedAt?.toISOString() ?? null };
}

/** Closes the pooled connections; called on shutdown, after in-flight requests finish. */
export function closeSmtp(): void {
  mailer?.close();
  mailer = null;
}
