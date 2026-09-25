import { randomUUID } from "node:crypto";
import { stdSerializers } from "pino";
import { pinoHttp } from "pino-http";
import { logger } from "../../config/logger/logger.js";

/** A caller-supplied id is reused only if it looks like one, so a client
 *  cannot inject arbitrary text into every log line of its request. */
const SAFE_REQUEST_ID = /^[\w-]{8,64}$/;

/**
 * Query parameters that carry credentials (an OAuth callback's code and
 * state, tokens, passwords). Their values never reach the logs.
 */
const SECRET_PARAMS = new Set([
  "code",
  "state",
  "session_state",
  "id_token",
  "access_token",
  "refresh_token",
  "token",
  "client_secret",
  "password",
]);

/** The URL as logged: path and query, with credential values replaced. */
export function redactUrl(url: string): string {
  const q = url.indexOf("?");
  if (q === -1) return url;
  const params = new URLSearchParams(url.slice(q + 1));
  let changed = false;
  for (const key of new Set(params.keys())) {
    if (SECRET_PARAMS.has(key.toLowerCase())) {
      params.set(key, "REDACTED");
      changed = true;
    }
  }
  return changed ? `${url.slice(0, q)}?${params.toString()}` : url;
}

/** Method and path only — the default serializer logs every header. */
export const serializeRequest = stdSerializers.wrapRequestSerializer((req) => ({
  id: req.id,
  method: req.method,
  url: redactUrl(req.url),
  remoteAddress: req.remoteAddress,
}));

/**
 * One structured line per request: id, method, url, status and duration.
 * The id is echoed in `x-request-id` and in every error body, so a user
 * reporting a failure can hand over the one string that finds its log line.
 */
export const requestLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const incoming = req.headers["x-request-id"];
    const id = typeof incoming === "string" && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
    res.setHeader("x-request-id", id);
    return id;
  },
  customLogLevel: (_req, res, err) =>
    err || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
  serializers: {
    req: serializeRequest,
    // From the raw response: the wrapped one reports null until headers flush.
    res: stdSerializers.wrapResponseSerializer((res) => ({ statusCode: res.raw.statusCode })),
  },
  // Probes hit these every few seconds; logging them would drown real traffic.
  autoLogging: { ignore: (req) => req.url === "/health" || req.url === "/ready" },
});
