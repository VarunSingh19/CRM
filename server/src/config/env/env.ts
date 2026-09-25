import { existsSync } from "node:fs";
import { z } from "zod";

/**
 * The only file that reads process.env. Everything else imports `env`, so a
 * missing or malformed variable stops the process at boot with a readable
 * message instead of surfacing as a 500 on the first request that needs it.
 * A new variable goes into this schema and into .env.example together.
 */
const csv = z
  .string()
  .default("")
  .transform((s) =>
    s
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  );

const bool = z.enum(["true", "false"]).transform((v) => v === "true");
const int = (min: number, max: number) => z.coerce.number().int().min(min).max(max);
/** `KEY=` with nothing after it counts as not set. */
const blankAsUnset = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), schema.optional());

/** SMTP ports that are encrypted from the first byte (implicit TLS)… */
const IMPLICIT_TLS_PORTS = new Set([465, 2465]);
/** …and those that start in plain text and must upgrade with STARTTLS. */
const STARTTLS_PORTS = new Set([25, 587, 2587]);

/** "support@onference.in" or "Onference CRM <support@onference.in>"; null if neither. */
export function parseSender(value: string): { name?: string; address: string } | null {
  const match = /^(?:([^<>"\r\n]*?)\s*<([^<>\s]+)>|([^<>\s]+))$/.exec(value.trim());
  const address = match?.[2] ?? match?.[3];
  if (!address || !z.email().safeParse(address).success) return null;
  const name = match?.[1]?.trim();
  return name ? { name, address } : { address };
}

/**
 * Connection-string options that switch off certificate or hostname checks.
 * Refused in every environment: a private CA belongs in MONGODB_TLS_CA_FILE,
 * never in "trust any certificate".
 */
const INSECURE_TLS_OPTIONS = ["tlsinsecure", "tlsallowinvalidcertificates", "tlsallowinvalidhostnames", "sslvalidate"];

/** Headers the custom header must not be confused with. */
const RESERVED_HEADERS = new Set([
  "authorization",
  "cookie",
  "host",
  "origin",
  "referer",
  "user-agent",
  "content-type",
  "content-length",
  "connection",
  "x-forwarded-for",
  "x-request-id",
]);

/** The query-string options of a MongoDB URI, with lower-cased names. */
function uriOptions(uri: string): Map<string, string> {
  const q = uri.indexOf("?");
  const params = new URLSearchParams(q === -1 ? "" : uri.slice(q + 1));
  return new Map([...params].map(([k, v]) => [k.toLowerCase(), v.toLowerCase()]));
}

/** Does the URI carry a username (mongodb://user:pass@host)? */
const uriHasCredentials = (uri: string) => /^mongodb(\+srv)?:\/\/[^/?#]+@/.test(uri);

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: int(1, 65_535).default(4000),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),

    /**
     * Browser origins (scheme://host[:port]) allowed to make credentialed
     * requests. Used for CORS and for the cross-site request forgery check on
     * every state-changing request.
     */
    ALLOWED_ORIGINS: csv.pipe(z.array(z.url())),
    TRUST_PROXY: int(0, 10).default(0),

    /** Per client address, counting failed requests: the flood guard on /api. */
    RATE_LIMIT_IP_WINDOW_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(5 * 60 * 1000),
    RATE_LIMIT_IP_MAX: z.coerce.number().int().positive().default(300),

    /** After SIGTERM, how long to keep serving while /ready reports 503. */
    SHUTDOWN_DELAY_MS: int(0, 60_000).default(0),

    /** Swagger UI at /api-docs. Defaults to on outside production. */
    SWAGGER_ENABLED: bool.optional(),

    // ------------------------------------------------------------- database
    MONGODB_URI: z
      .string()
      .regex(/^mongodb(\+srv)?:\/\/\S+$/, "must be a mongodb:// or mongodb+srv:// connection string"),
    /**
     * Credentials kept out of the URI, so a secret store can inject them and
     * special characters need no percent-encoding. Both or neither.
     */
    MONGODB_USERNAME: z.string().min(1).optional(),
    MONGODB_PASSWORD: z.string().min(1).optional(),
    /** Encryption in transit. Forced on in production; on by default for mongodb+srv. */
    MONGODB_TLS: bool.optional(),
    /** PEM file of the CA that signed the database's certificate (a private CA). */
    MONGODB_TLS_CA_FILE: z.string().min(1).optional(),
    /** PEM file with this app's client certificate and key: mutual TLS / X.509 sign-in. */
    MONGODB_TLS_CERT_KEY_FILE: z.string().min(1).optional(),
    MONGODB_TLS_CERT_KEY_PASSWORD: z.string().min(1).optional(),
    /** Pool: at most this many connections per API process. */
    MONGODB_MAX_POOL_SIZE: int(1, 500).default(20),
    /** Pool: connections kept open even when idle (0 = none). */
    MONGODB_MIN_POOL_SIZE: int(0, 100).default(0),
    /** Pool: an idle connection is closed after this long. */
    MONGODB_MAX_IDLE_TIME_MS: int(1_000, 3_600_000).default(60_000),
    /** Pool: a request waiting for a free connection fails after this long, instead of queueing forever. */
    MONGODB_WAIT_QUEUE_TIMEOUT_MS: int(100, 120_000).default(10_000),
    /** Shown in the database's own logs and currentOp, to tell this app's connections apart. */
    MONGODB_APP_NAME: z
      .string()
      .regex(/^[\w.-]{1,64}$/)
      .default("onference-crm-api"),

    // -------------------------------------------------------- custom header
    /**
     * Every /api request must carry this header with this value — a shared
     * key that proves the call comes from our own frontend or service.
     * Set CUSTOM_HEADER_ENABLED=false to bypass the check (e.g. locally).
     */
    CUSTOM_HEADER_ENABLED: bool.default(true),
    CUSTOM_HEADER_NAME: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be a header name like x-api-key")
      .default("x-api-key"),
    CUSTOM_HEADER_VALUE: z.string().optional(),

    // ----------------------------------------------------------------- email
    /**
     * Outgoing email over SMTP (Amazon SES). Always encrypted: implicit TLS on
     * 465/2465, mandatory STARTTLS on any other port. Required in production;
     * elsewhere, an empty SMTP_HOST switches email off.
     */
    SMTP_HOST: blankAsUnset(
      z
        .string()
        .trim()
        .regex(/^[a-z0-9.-]+$/i, "must be a host name like email-smtp.us-east-1.amazonaws.com"),
    ),
    /** 465 (implicit TLS) or 587 (STARTTLS); defaults to 587. */
    SMTP_PORT: blankAsUnset(int(1, 65_535)),
    /** Implicit TLS. Defaults from the port (true for 465/2465); set it only for an unusual port. */
    SMTP_SECURE: blankAsUnset(bool),
    /** SES: the SMTP credentials generated in the SES console, not the AWS access keys. */
    SMTP_USER: blankAsUnset(z.string()),
    SMTP_PASS: blankAsUnset(z.string()),
    /** The sender of every email, and a verified identity in SES. */
    FROM_EMAIL: blankAsUnset(
      z
        .string()
        .refine(
          (v) => parseSender(v) !== null,
          "must be an address like support@onference.in, or Name <support@onference.in>",
        ),
    ),
    /**
     * Messages per second this process may send: the SES account's sending
     * rate divided by the number of API processes (SES counts the account).
     */
    SES_RATE_PER_SEC: blankAsUnset(int(1, 1_000)),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    const options = uriOptions(v.MONGODB_URI);
    const production = v.NODE_ENV === "production";

    // database: credentials
    if (!!v.MONGODB_USERNAME !== !!v.MONGODB_PASSWORD) {
      issue(
        v.MONGODB_USERNAME ? "MONGODB_PASSWORD" : "MONGODB_USERNAME",
        "MONGODB_USERNAME and MONGODB_PASSWORD go together",
      );
    }
    if (v.MONGODB_USERNAME && uriHasCredentials(v.MONGODB_URI)) {
      issue("MONGODB_URI", "carries credentials as well as MONGODB_USERNAME; keep them in one place");
    }

    // database: encryption
    for (const option of INSECURE_TLS_OPTIONS) {
      const value = options.get(option);
      // tlsInsecure is refused outright: the driver rejects it next to the
      // explicit certificate checks database.ts always sets.
      const insecure =
        option === "tlsinsecure"
          ? value !== undefined
          : option === "sslvalidate"
            ? value === "false"
            : value === "true";
      if (insecure) {
        issue(
          "MONGODB_URI",
          `must not switch off certificate checks (${option}); use MONGODB_TLS_CA_FILE for a private CA`,
        );
      }
    }
    const uriTls = options.get("tls") ?? options.get("ssl");
    if (v.MONGODB_TLS !== undefined && uriTls !== undefined && String(v.MONGODB_TLS) !== uriTls) {
      issue("MONGODB_TLS", "contradicts tls= in MONGODB_URI; set it in one place");
    }
    for (const key of ["MONGODB_TLS_CA_FILE", "MONGODB_TLS_CERT_KEY_FILE"] as const) {
      const file = v[key];
      if (file && !existsSync(file)) issue(key, "file does not exist");
    }
    if (v.MONGODB_TLS_CERT_KEY_PASSWORD && !v.MONGODB_TLS_CERT_KEY_FILE) {
      issue("MONGODB_TLS_CERT_KEY_PASSWORD", "is set without MONGODB_TLS_CERT_KEY_FILE");
    }
    if (v.MONGODB_MIN_POOL_SIZE > v.MONGODB_MAX_POOL_SIZE) {
      issue("MONGODB_MIN_POOL_SIZE", "cannot be larger than MONGODB_MAX_POOL_SIZE");
    }

    // custom header
    if (RESERVED_HEADERS.has(v.CUSTOM_HEADER_NAME)) {
      issue("CUSTOM_HEADER_NAME", "must not reuse a standard header");
    }
    if (v.CUSTOM_HEADER_ENABLED && (v.CUSTOM_HEADER_VALUE?.length ?? 0) < 32) {
      issue(
        "CUSTOM_HEADER_VALUE",
        "must be at least 32 random characters while CUSTOM_HEADER_ENABLED is true (or set CUSTOM_HEADER_ENABLED=false)",
      );
    }

    // email
    if (!!v.SMTP_USER !== !!v.SMTP_PASS) {
      issue(v.SMTP_USER ? "SMTP_PASS" : "SMTP_USER", "SMTP_USER and SMTP_PASS go together");
    }
    if (v.SMTP_HOST && !v.FROM_EMAIL) {
      issue("FROM_EMAIL", "is required with SMTP_HOST: it is the sender of every email");
    }
    if (!v.SMTP_HOST && (v.SMTP_USER || v.FROM_EMAIL)) {
      issue("SMTP_HOST", "is empty while other SMTP settings are set; set it, or clear them all to switch email off");
    }
    const port = v.SMTP_PORT ?? 587;
    if (v.SMTP_SECURE === true && STARTTLS_PORTS.has(port)) {
      issue("SMTP_SECURE", `port ${port} upgrades with STARTTLS; remove SMTP_SECURE=true, or use port 465`);
    }
    if (v.SMTP_SECURE === false && IMPLICIT_TLS_PORTS.has(port)) {
      issue("SMTP_SECURE", `port ${port} is TLS from the first byte; remove SMTP_SECURE=false, or use port 587`);
    }

    if (!production) return;
    if (v.ALLOWED_ORIGINS.length === 0) {
      issue("ALLOWED_ORIGINS", "must list the frontend origin in production, or every browser write is refused");
    }
    for (const origin of v.ALLOWED_ORIGINS) {
      if (!origin.startsWith("https://")) issue("ALLOWED_ORIGINS", `must use https in production (${origin})`);
    }
    if (v.MONGODB_TLS === false || options.get("tls") === "false" || options.get("ssl") === "false") {
      issue("MONGODB_TLS", "cannot be off in production: the database connection must be encrypted");
    }
    const x509 = options.get("authmechanism") === "mongodb-x509" && !!v.MONGODB_TLS_CERT_KEY_FILE;
    if (!v.MONGODB_USERNAME && !uriHasCredentials(v.MONGODB_URI) && !x509) {
      issue("MONGODB_URI", "must authenticate in production: set MONGODB_USERNAME/MONGODB_PASSWORD, or use X.509");
    }
    if (!v.SMTP_HOST || !v.SMTP_USER) {
      issue(
        "SMTP_HOST",
        "email is required in production: set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and FROM_EMAIL",
      );
    }
  })
  .transform((v) => ({
    ...v,
    SWAGGER_ENABLED: v.SWAGGER_ENABLED ?? v.NODE_ENV !== "production",
    SMTP_PORT: v.SMTP_PORT ?? 587,
    SMTP_SECURE: v.SMTP_SECURE ?? IMPLICIT_TLS_PORTS.has(v.SMTP_PORT ?? 587),
    SES_RATE_PER_SEC: v.SES_RATE_PER_SEC ?? 1,
    // Forced on in production; otherwise as set, else as the URI says
    // (tls=true, or mongodb+srv:// which implies it), else off for a local mongod.
    MONGODB_TLS:
      v.NODE_ENV === "production" ||
      (v.MONGODB_TLS ??
        (v.MONGODB_URI.startsWith("mongodb+srv://") ||
          (uriOptions(v.MONGODB_URI).get("tls") ?? uriOptions(v.MONGODB_URI).get("ssl")) === "true")),
  }));

export type Env = z.infer<typeof envSchema>;

/** Parses and validates an environment; exported so the rules can be tested. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    // Names and reasons only — never echo the values.
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return parsed.data;
}

export const env: Env = parseEnv(process.env);
