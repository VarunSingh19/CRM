# Onference CRM API

Express 5 + TypeScript 7, with the security baseline, an encrypted MongoDB connection, encrypted email over SMTP (Amazon SES), a custom API-key header, health probes and Swagger docs. No sign-in or tests yet; they come with the first features.

## Quick start

```bash
cd demo
cp .env.example .env   # set MONGODB_URI, CUSTOM_HEADER_VALUE (or CUSTOM_HEADER_ENABLED=false), and the SMTP_* values for email
npm install
npm run dev          # http://localhost:4000
```

- Health: <http://localhost:4000/health> (database + email), <http://localhost:4000/live>, <http://localhost:4000/ready>
- API docs: <http://localhost:4000/api-docs> (the raw spec is at `/api-docs/openapi.json`)

| Script                                | Does                                                          |
| ------------------------------------- | ------------------------------------------------------------- |
| `npm run dev`                         | Run with reload, reading `.env`                               |
| `npm run build` / `npm start`         | Compile to `dist/` (copies `src/docs`), then run it with Node |
| `npm run typecheck`                   | TypeScript, no output                                         |
| `npm run check` / `npm run check:fix` | Biome: lint, format and import order (`check:fix` rewrites)   |

## Where things go

One folder per layer. Inside each layer, one folder per feature (or per concern), then the file.

```
index.js                       Vercel entry: serves the compiled dist/serverless.js (run `npm run build` first)
src/
├── server.ts                  starts the server; graceful shutdown
├── serverless.ts              the app for Vercel: connects on the first request; no listen(), no signals
├── app.ts                     builds the app; global middleware order
├── config/                    env/env.ts · logger/logger.ts · database/database.ts · smtp/smtp.ts · swagger/swagger.ts
├── docs/                      openapi.yml — the API contract (Swagger)
├── middlewares/               requestLogger/ · security/ · rateLimiter/ · customHeader/ · originCheck/ · validate/ · errorHandler/
├── routes/                    index.ts (mounts everything) · health/ · docs/ · users/ · settings/
├── controllers/               health/ · users/ · settings/
├── services/                  health/ · mail/ · users/ · settings/
├── repositories/              users/ · settings/
├── models/                    users/ · settings/
├── validators/                users/ · settings/
└── utils/                     errors/AppError.ts · lifecycle/lifecycle.ts
```

- **Feature layers** name the file after the layer: `controllers/users/controller.ts`, `routes/users/routes.ts`, `services/users/service.ts`, `repositories/users/repository.ts`, `models/users/model.ts`, `validators/users/validator.ts`. The users and settings files are empty placeholders.
- **Shared folders** (`config`, `middlewares`, `utils`) name the file after the concern: `middlewares/rateLimiter/rateLimiter.ts`.

### What each layer may do

| Layer        | Does                                                             | Never                                                   |
| ------------ | ---------------------------------------------------------------- | ------------------------------------------------------- |
| routes       | Wires a path to `validate()` and a controller method             | Logic or permission checks                              |
| validators   | Zod schemas for params, query and body                           | Touch the database                                      |
| controllers  | Reads the validated request, calls a service, sends the response | Query the database or use a model                       |
| services     | Business rules and every permission check                        | Touch `req` or `res`                                    |
| repositories | Database queries, returning plain objects                        | Business rules                                          |
| models       | Schemas and indexes                                              | Be imported from outside their own feature's repository |

### Adding a feature (for example, users)

1. `validators/users/validator.ts`: Zod schemas for each route's input.
2. `models/users/model.ts` and `repositories/users/repository.ts`, once the database is connected.
3. `services/users/service.ts`: the rules; throw `AppError` (or `ForbiddenError`/`NotFoundError`) for anything the client may see.
4. `controllers/users/controller.ts`: thin HTTP handlers. Just `throw`; Express 5 sends rejected promises to the error handler, so no try/catch.
5. `routes/users/routes.ts`: `router.post("/", validate({ body: createUserBody }), usersController.create)`.
6. Mount it in `routes/index.ts`: `api.use("/users", usersRouter)`.
7. Document it in `src/docs/openapi.yml`, reusing `components.responses` for the errors.

### Sending an email

From a service (never a controller), through `services/mail/service.ts`:

```ts
import { mailService } from "../mail/service.js";

await mailService.send({
  to: user.email,                // one address, or an array of up to 50
  subject: "Your CRM access was approved",
  text: "Hi Priya, you can now sign in.",
  html: "<p>Hi Priya, you can now sign in.</p>",   // optional
});
```

- It is sent from `FROM_EMAIL`. The subject must be one line (a line break could inject a header).
- If SES can't be reached or refuses, it throws `503 EMAIL_UNAVAILABLE`, which the error handler sends to the client.
- With email switched off (no `SMTP_HOST`, development only), it logs a warning and returns `null`.
- Recipients, subjects and bodies are never logged: only the message id and the recipient count.

## Request pipeline

```
requestLogger (x-request-id; secrets redacted) → helmet headers → CORS allowlist
  → /live, /health, /ready              probes: no limits, no custom header
  → /api-docs                           Swagger UI (SWAGGER_ENABLED only)
  → /api: no-store → per-IP flood guard → custom header → origin check → JSON body (100 kb) + cookies → feature routers
  → JSON 404 → error handler
```

## Security baseline, already in place

- **Config:**
  - `config/env/env.ts` is the only reader of `process.env`, and every variable is validated with Zod;
  - bad config stops the boot, listing variable names but never their values;
  - production requires `https` origins in `ALLOWED_ORIGINS`.
- **Headers:**
  - helmet's defaults: a CSP, HSTS, nosniff, no framing by other sites, no `X-Powered-By`;
  - `upgrade-insecure-requests` applies in production only, so Swagger works over plain HTTP in development;
  - `/api` responses carry `Cache-Control: no-store`.
- **CORS:** only the origins in `ALLOWED_ORIGINS`, with credentials. The frontend can read `X-Total-Count` and `X-Request-Id`.
- **Custom header:** every `/api` request must send `CUSTOM_HEADER_NAME` (default `x-api-key`) with the value in `CUSTOM_HEADER_VALUE`, or it gets `401 INVALID_API_KEY`.
  - The value must be at least 32 random characters and is compared in constant time. It is never logged.
  - Health probes don't need it. Swagger's **Authorize** button sends it.
  - **Bypass:** `CUSTOM_HEADER_ENABLED=false` switches the check off, and the server logs that it is off at startup (as a warning in production).
  - It identifies the calling _app_, not a user. A value sent from a browser is visible in its dev tools, so a web frontend should add it server-side (the Next.js server or proxy).
- **Forgery (CSRF):** a POST, PATCH or DELETE carrying another site's `Origin` gets `403 ORIGIN_REJECTED`.
- **Abuse:**
  - one address gets 300 failed `/api` requests per 5 minutes, then `429`;
  - bodies are parsed only after that guard and the origin check, and capped at 100 kb.
- **Input:**
  - `validate()` strips unknown keys, which stops mass assignment;
  - the query parser can't produce `{ "$ne": … }`, so no MongoDB operator injection through query strings.
- **Errors:**
  - one shape, `{ error, code, requestId, details? }`;
  - anything unexpected is a generic 500, with the detail in the log only.
- **Logs:**
  - one JSON line per request;
  - cookies, authorization headers, passwords and tokens are redacted, including `code`, `state` and tokens in URLs.
- **Shutdown:**
  - on SIGTERM, `/ready` returns 503, the server waits `SHUTDOWN_DELAY_MS`, drains requests for up to 10 s, then exits;
  - an unhandled error crashes the process on purpose, so the supervisor restarts it clean.
- **Database connection** (`config/database/database.ts`):
  - **Encrypted:** TLS is always on in production, and on for `mongodb+srv://` (Atlas). Certificates and hostnames are always verified; a URI that tries to switch that off (`tlsInsecure`, `tlsAllowInvalidCertificates`, `tlsAllowInvalidHostnames`) stops the boot. A private CA goes in `MONGODB_TLS_CA_FILE`.
  - **Mutual TLS / X.509:** `MONGODB_TLS_CERT_KEY_FILE` presents a client certificate when the database requires one.
  - **Authenticated:** production refuses to start without credentials. `MONGODB_USERNAME`/`MONGODB_PASSWORD` keep them out of the URI (the driver uses SCRAM-SHA-256). Credentials are never logged, and are scrubbed from driver errors.
  - **Pool:** at most `MONGODB_MAX_POOL_SIZE` connections per process. A request that can't get one within `MONGODB_WAIT_QUEUE_TIMEOUT_MS` fails fast instead of queueing forever, and idle connections close after `MONGODB_MAX_IDLE_TIME_MS`. Writes are retried once and acknowledged by a majority.
  - **Lifecycle:** it connects before the server takes traffic (a failure exits, so the supervisor retries), `/health` and `/ready` ping it for real, and it closes after in-flight requests on shutdown. Drops, pool resets, and the start and end of an outage are logged, once each.
  - **Network / tunnel:** keep the database off the public internet. Use a private endpoint or VPC peering (Atlas: Private Endpoint), and allow only the API servers' addresses. Keep TLS on inside the private network as well. The app doesn't open SSH tunnels itself: a tunnel is an ops tool for people, not something the app should hold keys for.
- **Email (SMTP, `config/smtp/smtp.ts`):**
  - **Encrypted:** port 465 is TLS from the first byte. Any other port must upgrade with STARTTLS: a relay (or anyone in between) that won't is refused before the password is sent. There is no plain-text fallback. Certificates and host names are always verified, TLS 1.2 or newer.
  - **Credentials** come from `SMTP_USER`/`SMTP_PASS` (the SES SMTP credentials, not AWS keys). They are never logged, and the SMTP conversation, which carries the sign-in, is never logged either.
  - **Rate:** sends are spaced evenly at `SES_RATE_PER_SEC` per process, so a burst waits in line instead of being throttled by SES. Set it to the account's rate divided by the number of API processes.
  - **Pool:** up to 3 reused connections, with timeouts in seconds, not nodemailer's minutes.
  - **Messages:** at most 50 recipients (the SES limit). No local files or URLs can be pulled into a message.
  - **Startup:** the relay is checked at boot, alongside the database. A failure is logged and shown on `/health`, but isn't fatal, because the API still works without email. Production refuses to start without the SMTP settings.
- **Swagger** is off in production unless `SWAGGER_ENABLED=true`. To use "Try it out" for POST/PATCH/DELETE in development, add `http://localhost:4000` to `ALLOWED_ORIGINS`.

## Health checks

| Probe | Checks | 200 | 503 | Point at it |
|---|---|---|---|---|
| `/live` | the process only, no I/O | always, while it runs | never | the orchestrator's restart (liveness) probe |
| `/health` | a real database ping (2 s timeout) | `true`, also while only email is down | `false`: the database doesn't answer | uptime monitors, dashboards, people |
| `/ready` | the database ping, and whether shutdown has begun | `true` | `false`: the database doesn't answer, or shutdown has begun | the load balancer |

```json
GET /health
{ "status": true, "checkedAt": "2026-09-25T10:30:00.000Z" }
```

- The response is only `status` and `checkedAt`: which services exist, and how each is doing, stay in the log, so a public probe doesn't map the backend.
- Only the database decides the status. Email being down doesn't stop the API, so it stays a `200` and is logged as an error (`smtp unavailable`), once when it goes down.
- Probes within 2 s share one database ping, so a flood of `/health` calls can't load the database.
- Email isn't signed in to on every probe, which would be slow and could get SES to throttle the account. `/health` starts a background recheck every 5 minutes (every 30 s while failing), and every real send updates it too.
- Don't point a restart probe at `/health`: a database outage would restart every healthy process.

## Not included yet (on purpose)

Sign-in, sessions and role checks, and tests. `rateLimiter.ts` notes what sign-in adds to the limits. `../server` is the full reference implementation.
