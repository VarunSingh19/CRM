# Onference CRM — Technical Documentation

Internal content-operations and commercial-documents portal for **Onference TV**
(`onference-tv`, v1.0.0). A Next.js 15 App Router application backed by MongoDB
via Mongoose, with credential authentication (NextAuth v5) and a server-enforced
role-based access control matrix.

This document covers every API endpoint, every data model, every package, and the
domain rules that sit between them.

---

## Table of contents

1. [Overview](#1-overview)
2. [Tech stack](#2-tech-stack)
3. [Getting started](#3-getting-started)
4. [npm scripts](#4-npm-scripts)
5. [Project structure](#5-project-structure)
6. [Request lifecycle](#6-request-lifecycle)
7. [Authentication](#7-authentication)
8. [Authorization (RBAC)](#8-authorization-rbac)
9. [API reference](#9-api-reference)
10. [Data models](#10-data-models)
11. [Domain logic reference](#11-domain-logic-reference)
12. [UI route map](#12-ui-route-map)
13. [Shared components](#13-shared-components)
14. [Packages](#14-packages)
15. [Configuration files](#15-configuration-files)
16. [Deployment & operations](#16-deployment--operations)
17. [Behaviours worth knowing](#17-behaviours-worth-knowing)

---

## 1. Overview

The application replaces a legacy single-file HTML tool that produced estimates,
kick-off documents, invoice requests and content calendars for Onference TV's media
business. It keeps the legacy money maths and document layouts identical while
adding multi-user accounts, a shared database, an audit trail and role separation.

### Core concepts

| Concept                             | Meaning                                                                                                                                                                                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Project**                         | One engagement with one partner. Carries the partner snapshot, tax/terms, kick-off dates and the issuing-entity snapshot. Documents are generated per project.                                                                                                      |
| **Line item** (content item / card) | One piece of content sold and delivered under a project — a video, a blog, a CME session. Carries both commercials (rate, qty, discount) and production scheduling (record date, release date, end dates). Stored in its own collection, referenced by `projectId`. |
| **Partner**                         | The reusable customer/vendor record. A project takes a denormalised _snapshot_ of the partner at the time of writing, so a later partner edit never rewrites an issued document.                                                                                    |
| **Contact**                         | One person at one partner. The history behind a partner's current `contact` field — when the person at a partner changes, the old row stays.                                                                                                                        |
| **Offering** (catalog)              | Master data: the sellable products, their card types, streams, and default inclusion/exclusion scope text. Adding a line item copies the offering's scope onto it.                                                                                                  |
| **Document**                        | Generated Word-compatible HTML (`.doc`) — estimate, kick-off, invoice request, content calendar — plus an `.ics` reminder file.                                                                                                                                     |
| **Proposal**                        | A single-card estimate priced independently of the project, with its own partner override. The legacy "Propose" flow.                                                                                                                                               |

### The three roles

| Role      | Sees                                      | Can do                                                                                                                                                                                                                                    |
| --------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **admin** | Everything                                | Full CRUD on projects, line items, partners, catalog, users, settings. Only role that can read the audit log or permanently delete.                                                                                                       |
| **sales** | All projects (read), own projects (write) | Create/edit own projects, line items and partners; generate estimate / kick-off / invoice / calendar. No deletes on projects or partners, no catalog/user/settings writes, no audit log.                                                  |
| **ops**   | All projects (production view)            | Edit only production fields on any project; create and edit line items. **Blind to pricing** — commercial fields are stripped server-side on the way out and rejected on the way in. Generates kick-off + content calendar + `.ics` only. |

The single source of truth is `src/lib/rbac.ts`. Every service checks it; the UI
only mirrors it.

---

## 2. Tech stack

| Layer            | Choice                                                                      | Version                                 |
| ---------------- | --------------------------------------------------------------------------- | --------------------------------------- |
| Framework        | Next.js (App Router, React Server Components)                               | 15.5.24 (declared `^15.1.6`)            |
| UI runtime       | React / React DOM                                                           | 19.2.8                                  |
| Language         | TypeScript (`strict: true`)                                                 | 5.9.3                                   |
| Database         | MongoDB via Mongoose ODM                                                    | mongoose 8.24.4 / mongodb driver 6.20.0 |
| Auth             | NextAuth v5 (Auth.js) — Credentials provider, JWT sessions                  | 5.0.0-beta.25                           |
| Password hashing | bcryptjs (cost factor 10)                                                   | 2.4.3                                   |
| Script runner    | tsx                                                                         | 4.23.12                                 |
| Styling          | Hand-written CSS (`src/app/globals.css`, ~3,800 lines) + `next/font` (Lato) | —                                       |

No CSS framework, no component library, no state-management library, no ORM
beyond Mongoose, and no test framework currently configured.

---

## 3. Getting started

### Requirements

- **Node.js 18+**
- A **MongoDB** instance — local (`mongodb://127.0.0.1:27017`) or Atlas

### Install

```bash
npm install
```

### Configure environment

```bash
cp .env.example .env.local
```

`.env.local` must define:

| Variable      | Required | Purpose                                                                                                 |
| ------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| `MONGODB_URI` | **Yes**  | Mongo connection string. `connectDB()` throws immediately if absent.                                    |
| `AUTH_SECRET` | **Yes**  | JWT signing/encryption secret for NextAuth. Generate with `npx auth secret`, or any long random string. |

Optional, read by Next/NextAuth rather than by application code:

| Variable                    | Purpose                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_URL` / `NEXTAUTH_URL` | Canonical origin. Usually unnecessary — `authConfig` sets `trustHost: true`.                                              |
| `NODE_ENV`                  | Set to `production` by `next build` / `next start`. Controls model hot-reload recompilation (see [§10](#10-data-models)). |

The seed and maintenance scripts load `.env.local` (then `.env`) themselves with a
small hand-rolled parser — values already present in `process.env` always win.

### Seed and run

```bash
npm run seed      # users + catalog + company settings
npm run dev       # http://localhost:3000
```

### Seeded logins

| Username | Password         | Role  |
| -------- | ---------------- | ----- |
| `admin`  | `Onference@2026` | admin |
| `sales`  | `Sales@2026`     | sales |
| `ops`    | `Ops@2026`       | ops   |

These are defaults only — change them via the Users screen (admin) before any real
use. Re-running `npm run seed` **never** resets a password that has since been
changed; the hash is written with `$setOnInsert`.

---

## 4. npm scripts

| Script              | Command                                    | What it does                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`       | `next dev`                                 | Development server with hot reload.                                                                                                                                                                                                                                                                                                                                                      |
| `npm run build`     | `next build`                               | Production build.                                                                                                                                                                                                                                                                                                                                                                        |
| `npm start`         | `next start`                               | Serve the production build.                                                                                                                                                                                                                                                                                                                                                              |
| `npm run lint`      | `next lint`                                | ESLint via Next's wrapper.                                                                                                                                                                                                                                                                                                                                                               |
| `npm run seed`      | `tsx src/scripts/seed.ts`                  | Idempotent: upserts the three default users, the 21-offering catalog, and the company settings singleton. Never clobbers edits — catalog content is `$setOnInsert` only (sort order is kept in sync), and settings are backfilled field-by-field only where still blank.                                                                                                                 |
| `npm run indexes`   | `tsx src/scripts/ensure-indexes.ts`        | Builds every declared index explicitly (Mongoose `autoIndex` is off in production). Pre-flights duplicate `User.email` values and names every clashing pair before failing, since `email` carries a unique partial index.                                                                                                                                                                |
| `npm run seed:demo` | `tsx src/scripts/seed-demo.ts`             | Loads a realistic demo book of business. Flags: `-- --reset` (remove then re-add), `-- --clear` (remove and stop). Only touches records whose names appear in `src/scripts/demo-data.ts`, so it is safe against a database holding real work. Dates are generated relative to the run date; the PRNG is seeded, so runs are deterministic. Demo accounts share the password `Demo@2026`. |
| _(no script)_       | `npx tsx src/scripts/backfill-contacts.ts` | One-off: seeds the contact directory from the `contact` / `email` / `mobile` already stored on each partner. Safe to re-run — `recordContact` matches on name within the partner and updates rather than duplicating.                                                                                                                                                                    |

---

## 5. Project structure

```
internal-crm/
├── auth.ts                  NextAuth instance: Credentials provider + DB lookup (Node runtime)
├── auth.config.ts           Edge-safe NextAuth config (no Mongoose) — imported by middleware
├── next.config.ts           serverExternalPackages: mongoose, bcryptjs
├── tsconfig.json            strict, ES2022, path alias @/* -> ./src/*
├── .env.example             MONGODB_URI, AUTH_SECRET
├── public/                  favicon.ico, icon.png, onfnewlogo.png
└── src/
    ├── middleware.ts        Role-aware route guard (matcher excludes /api)
    ├── types/next-auth.d.ts Module augmentation: role + username on User/Session/JWT
    ├── lib/                 Cross-cutting infrastructure
    │   ├── db.ts            Cached Mongoose connection (survives hot reload)
    │   ├── rbac.ts          The permission matrix + field allow-lists + redaction
    │   ├── api.ts           withUser() route wrapper, readJson()
    │   ├── session.ts       requireUser / getUser / requireRole
    │   ├── money.ts         Legacy-ported num, money, calcLine, totals, toWords
    │   ├── defaults.ts      Company prefills, terms, SAC, sections, fyOf, toLocalISO
    │   ├── period.ts        Dashboard date-window resolution
    │   ├── catalog-seed-data.ts   The 21-offering master catalog
    │   ├── client.ts        Browser fetch wrapper (api<T>)
    │   ├── serialize.ts     JSON round-trip for the RSC -> client boundary
    │   ├── theme.ts         Client-safe theme/sidebar cookie helpers
    │   └── theme.server.ts  Server-side cookie read (no theme flash)
    ├── features/            One folder per domain: model + service (+ components)
    │   ├── auth/            LoginForm
    │   ├── users/           user.model, user.service
    │   ├── partners/        partner.model, partner.service
    │   ├── contacts/        contact.model, contact.service, contact.match
    │   ├── catalog/         offering.model, catalog.service
    │   ├── projects/        project.model, project.service,
    │   │                    estimate-sequence.model + .service
    │   ├── line-items/      line-item.model, line-item.service
    │   ├── proposals/       proposal.model
    │   ├── documents/       documents.service, generated-document.model,
    │   │                    templates/{shared,estimate,kickoff,invoice,calendar,ics}
    │   ├── settings/        settings.model, settings.service
    │   ├── audit/           audit-log.model, audit.service, audit.labels
    │   ├── dashboard/       dashboard.service
    │   ├── calendar/        calendar.service
    │   └── search/          search.service
    ├── app/                 Routing only — thin pages mounting shared views
    │   ├── layout.tsx       Root: Lato font, theme attribute, Providers
    │   ├── page.tsx         Redirects to /login or /<role>/dashboard
    │   ├── providers.tsx    SessionProvider > ToastProvider > ConfirmProvider
    │   ├── globals.css      All application styling
    │   ├── login/
    │   ├── api/             Route handlers (thin controllers -> services)
    │   ├── admin/           dashboard projects[/:id] calendar partners catalog
    │   │                    users settings audit profile
    │   ├── sales/           dashboard projects[/:id] calendar partners catalog profile
    │   └── ops/             dashboard projects[/:id] calendar catalog profile
    ├── components/
    │   ├── shell/           AppShell, Sidebar, Topbar, CommandPalette, nav.ts
    │   ├── pages/           Server components: one per screen, fetch + mount a view
    │   ├── views/           Shared client views (ProjectEditor, CalendarView, …)
    │   ├── project/         Editor sub-components (Ledger, SchedulingTable, …)
    │   ├── dashboard/       PeriodFilter
    │   ├── users/           DeleteUserDialog
    │   └── ui/              Primitives: Button, Badge, Card, Modal, Toast, …
    └── scripts/             seed, seed-demo, demo-data, ensure-indexes, backfill-contacts
```

> `skills/` at the repository root is an unrelated vendored project
> (`forth-ai-homepage-main`) and is git-ignored. It is not part of this application.

### Why this shape

Every screen exists once. The `src/app/{admin,sales,ops}/…/page.tsx` files are
two-line mounts of a shared component in `src/components/pages/`, which fetches on
the server and renders a shared client view. Adding a feature means a new
`src/features/x` folder plus one row in the RBAC matrix — the role trees never fork.

---

## 6. Request lifecycle

### Page request (server-rendered)

```
Browser
  └─> middleware.ts        signed in? right role area? else redirect
        └─> app/<role>/<page>/page.tsx
              └─> components/pages/<X>Page.tsx   (React Server Component)
                    ├─ requireUser() / requireRole()      session
                    ├─ <domain>.service()                 RBAC check + Mongo query
                    └─ serialize() -> <X>View             client component, hydrated
```

Page data arrives **inside the HTML**. The dashboard and audit log ship no client
JavaScript of their own; the project editor fetches all six of its dependencies in
parallel on the server rather than making sequential browser requests.

### API request

```
Browser fetch (lib/client.ts api<T>)
  └─> app/api/<resource>/route.ts
        └─> withUser(handler)          lib/api.ts
              ├─ getUser() -> 401 if absent
              ├─ await ctx.params
              ├─ handler({ user, req, params })
              │     └─> <domain>.service(user, …)
              │           ├─ can(role, resource, action)  -> ForbiddenError (403)
              │           ├─ ownership check for scope "own"
              │           ├─ field allow-list strip for ops
              │           ├─ Mongo write
              │           └─ writeAudit(…)  (never throws)
              └─ catch -> { error: message } with err.status ?? 400
                         (403 also writes an auth.denied audit entry)
```

> **Middleware does not protect `/api`.** Its matcher is
> `/((?!api|_next/static|_next/image|favicon.ico).*)`. API protection is entirely
> `withUser` plus the per-service RBAC checks.

---

## 7. Authentication

### Mechanism

NextAuth v5 with a **Credentials** provider and a **JWT** session strategy
(no database session store). The config is deliberately split:

| File             | Runtime   | Contains                                                                                                                                                          |
| ---------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.config.ts` | Edge-safe | Pages, session strategy, `trustHost`, `jwt`/`session` callbacks. **No Mongoose.** Imported by `src/middleware.ts`.                                                |
| `auth.ts`        | Node      | Spreads `authConfig` and adds the Credentials provider with the bcrypt + Mongo lookup, plus the `signOut` event. Exports `handlers`, `auth`, `signIn`, `signOut`. |

### Sign-in flow

1. `LoginForm` calls `signIn("credentials", { username, password, redirect: false })`.
2. `authorize()` lowercases and trims the identifier.
3. The identifier is matched against `username` **always**, and against `email`
   **only when it contains `@`**. Without that guard a plain username could match
   the empty-string email carried by accounts without one, and sign in as whichever
   document came back first.
4. Lookup is scoped to `{ active: true }`, so a deactivated account cannot sign in.
5. `bcrypt.compare` against `passwordHash` (which is `select: false` on the schema,
   so it is explicitly re-selected).
6. On success the returned user is `{ id, name, username, email, role }`.
7. On failure the UI shows one generic message — it never reveals whether a username
   exists — while the audit log records the specific reason
   (`unknown-or-inactive` or `bad-password`).

### Token and session shape

The `jwt` callback:

- On sign-in, copies `role`, `username` and `name` onto the token.
- On `trigger === "update"` carrying a `name`, refreshes `token.name`. This is what
  makes the profile page's `useSession().update({ name })` take effect in the top
  bar immediately rather than at the next sign-in.

The `session` callback maps `token.sub -> session.user.id`, plus `role` and `username`.

```ts
// src/types/next-auth.d.ts
interface Session {
  user: {
    id: string;
    role: "admin" | "sales" | "ops";
    username: string;
  } & DefaultSession["user"];
}
interface JWT {
  role?: AppRole;
  username?: string;
}
```

### Server helpers — `src/lib/session.ts`

| Helper              | Behaviour                                                                                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `requireUser()`     | Returns `CurrentUser`; **throws** `"Not authenticated"` if absent. Used by server pages.                                                                                      |
| `getUser()`         | Returns `CurrentUser \| null`. Used by `withUser`.                                                                                                                            |
| `requireRole(area)` | Redirects to `/login` when signed out, or to `/<role>/dashboard` when browsing another role's area. Second line of defence behind middleware; used by the three area layouts. |

```ts
interface CurrentUser {
  id: string;
  name: string;
  username: string;
  role: Role;
}
```

### Middleware — `src/middleware.ts`

| Situation                                                     | Result                        |
| ------------------------------------------------------------- | ----------------------------- |
| Not signed in, protected path (`/admin*`, `/sales*`, `/ops*`) | Redirect to `/login`          |
| Signed in, at `/login` or `/`                                 | Redirect to `ROLE_HOME[role]` |
| Signed in, inside another role's area                         | Redirect to own `ROLE_HOME`   |
| Otherwise                                                     | `NextResponse.next()`         |

`ROLE_HOME` = `/admin/dashboard`, `/sales/dashboard`, `/ops/dashboard`.

### Auth audit entries

Written by `writeAuthAudit` (separate from `writeAudit` because a failed sign-in
against an unknown username has no `CurrentUser` to attribute):

| Action              | When                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.login`        | Successful sign-in. `meta.via` records `"username"` or `"email"`.                                                                           |
| `auth.login.failed` | Unknown/inactive account, or wrong password. `meta.reason` distinguishes them.                                                              |
| `auth.logout`       | `signOut` event.                                                                                                                            |
| `auth.denied`       | Any 403 returned by `withUser` — records method, path and message. Since the UI hides forbidden controls, this only fires on a direct call. |

---

## 8. Authorization (RBAC)

Everything lives in **`src/lib/rbac.ts`**.

### Types

```ts
type Role = "admin" | "sales" | "ops";
type Resource =
  | "project"
  | "lineItem"
  | "partner"
  | "catalog"
  | "user"
  | "settings"
  | "calendar"
  | "dashboard"
  | "auditLog";
type Action = "create" | "read" | "update" | "delete";
type Scope = "all" | "own" | false; // "own" = only records the user owns
```

### The matrix

| Resource      | admin                   | sales                   | ops               |
| ------------- | ----------------------- | ----------------------- | ----------------- |
| **project**   | C:all R:all U:all D:all | C:own R:all U:own D:✗   | R:all U:all       |
| **lineItem**  | C:all R:all U:all D:all | C:own R:all U:own D:own | C:all R:all U:all |
| **partner**   | C:all R:all U:all D:all | C:own R:all U:own D:✗   | —                 |
| **catalog**   | C:all R:all U:all D:all | R:all                   | R:all             |
| **user**      | C:all R:all U:all D:all | —                       | —                 |
| **settings**  | C:all R:all U:all D:all | —                       | —                 |
| **calendar**  | R:all                   | R:all                   | R:all             |
| **dashboard** | R:all                   | R:own                   | R:all             |
| **auditLog**  | R:all                   | —                       | —                 |

`can(role, resource, action)` returns the `Scope`; a missing cell is `false`.

### Field-level rules

```ts
COMMERCIAL_FIELDS = ["rate", "qty", "discType", "discValue", "amountOverride"];
```

**`redactLineItemFor(role, item)`** — for `ops` only, deletes every commercial field
plus the computed `net`, `gross` and `disc`. Applied by `listLineItems`,
`createLineItem`, `updateLineItem` and `getCalendar`.

**`OPS_EDITABLE_PROJECT_FIELDS`** — the only project fields an ops PATCH may set:

```
koStart, koEnd, koContract, koOwner, koProducer, koNotes
```

**`OPS_EDITABLE_FIELDS`** — the only line-item fields an ops PATCH may set:

```
topic, projDesc, status, cardName,
recDate, relDate, cardEnd, videoEnd, brandEnd,
name, cardType, promo, stream, produced, dev
```

Anything else in an ops patch is silently dropped server-side before the write.
Two deliberate absences:

- **Commercial fields** — ops never _reads_ pricing, so accepting it on write would
  let a hand-rolled PATCH set a rate the sender could not read back.
- **`incl` / `excl`** — the agreed scope is what was sold, so it stays with sales
  even though ops delivers against it.

### Helpers

| Helper                          | Purpose                                                                  |
| ------------------------------- | ------------------------------------------------------------------------ |
| `can(role, resource, action)`   | Matrix lookup → `Scope`.                                                 |
| `redactLineItemFor(role, item)` | Strips commercials for ops.                                              |
| `canSeeMoney(role)`             | `role !== "ops"`. Gates dashboard revenue tiles and the partner count.   |
| `ForbiddenError`                | `Error` subclass carrying `status = 403`, mapped to a 403 by `withUser`. |

### Ownership enforcement

For `scope === "own"` the service compares `ownerId` against `user.id`:

- **Projects** — `assertCanWrite()` throws _"You can only modify your own projects."_
- **Line items** — resolved through `projectOwner(projectId)`, since line items carry
  no `ownerId` of their own. Bulk operations resolve the distinct set of parent
  projects and reject if **any** is not owned by the caller.
- **Partners** — direct `ownerId` comparison.
- **Contacts** — inherit partner visibility exactly (they are a detail of a partner).

`ownerId` is never reassignable through a PATCH — `updateProject` and
`updatePartner` both `delete patch.ownerId` before writing.

---

## 9. API reference

### Conventions

**Base URL** — all endpoints are relative to the deployment origin, e.g.
`http://localhost:3000/api/…`.

**Authentication** — every endpoint except `/api/auth/*` is wrapped in `withUser`,
which requires a valid NextAuth JWT session cookie. There is no API-key or bearer
scheme; browser session cookies are the only credential.

**Content type** — request bodies are `application/json`. `readJson()` swallows
parse errors and yields `{}`, so a malformed body is treated as an empty patch
rather than a 500.

**Responses** — JSON, except the document endpoints which return `text/html`,
`application/msword` or `text/calendar`.

**Errors** — uniform shape:

```json
{ "error": "Human-readable message" }
```

| Status | Meaning                                                                                                                                                 |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `401`  | No session. Body: `{ "error": "Not authenticated" }`                                                                                                    |
| `403`  | `ForbiddenError` from the RBAC layer. Also writes an `auth.denied` audit entry.                                                                         |
| `404`  | Explicitly returned by `GET /api/projects/[id]` only.                                                                                                   |
| `400`  | Default for every other thrown error — validation failures, Mongoose `CastError` on a malformed ObjectId, duplicate-key errors, domain rule violations. |

> There is no request-body schema validation layer. Services name the fields they
> accept (or strip the ones they do not); everything else is enforced by the
> Mongoose schema, which silently discards unknown keys.

**Dates** — `yyyy-mm-dd` **strings**, not `Date` objects, on projects and line items.
This matches the legacy form and keeps string comparison valid for range filters.
Only `createdAt` / `updatedAt` (Mongoose timestamps) are real dates.

**Identifiers** — MongoDB ObjectId hex strings, returned as `_id`.

---

### Endpoint index

| Method       | Path                            | Roles                                             | Purpose                                        |
| ------------ | ------------------------------- | ------------------------------------------------- | ---------------------------------------------- |
| `GET` `POST` | `/api/auth/[...nextauth]`       | public                                            | NextAuth handlers                              |
| `GET`        | `/api/projects`                 | admin, sales, ops                                 | List projects with item counts                 |
| `POST`       | `/api/projects`                 | admin, sales                                      | Create a project                               |
| `GET`        | `/api/projects/[id]`            | admin, sales, ops                                 | One project + its line items                   |
| `PATCH`      | `/api/projects/[id]`            | admin, sales (own), ops (limited fields)          | Update a project                               |
| `DELETE`     | `/api/projects/[id]`            | admin                                             | Delete a project and cascade its line items    |
| `GET`        | `/api/line-items?projectId=`    | admin, sales, ops                                 | List a project's line items                    |
| `POST`       | `/api/line-items`               | admin, sales (own), ops                           | Create a line item                             |
| `PATCH`      | `/api/line-items/[id]`          | admin, sales (own), ops (limited fields)          | Update a line item                             |
| `DELETE`     | `/api/line-items/[id]`          | admin, sales (own)                                | Delete a line item                             |
| `PATCH`      | `/api/line-items/bulk`          | admin, sales (own), ops (limited fields)          | Bulk field update                              |
| `POST`       | `/api/line-items/bulk`          | admin, sales (own)                                | Bulk delete                                    |
| `GET`        | `/api/partners`                 | admin, sales                                      | List partners                                  |
| `POST`       | `/api/partners`                 | admin, sales                                      | Create a partner                               |
| `PATCH`      | `/api/partners/[id]`            | admin, sales (own)                                | Update a partner                               |
| `DELETE`     | `/api/partners/[id]`            | admin                                             | Delete a partner and its contacts              |
| `GET`        | `/api/contacts`                 | admin, sales                                      | List the contact directory                     |
| `DELETE`     | `/api/contacts/[id]`            | admin, sales (own)                                | Remove a historical contact                    |
| `GET`        | `/api/catalog`                  | admin, sales, ops                                 | List active offerings                          |
| `POST`       | `/api/catalog`                  | admin                                             | Create an offering                             |
| `PATCH`      | `/api/catalog/[id]`             | admin                                             | Update an offering                             |
| `DELETE`     | `/api/catalog/[id]`             | admin                                             | Retire an offering (soft delete)               |
| `GET`        | `/api/users`                    | admin                                             | List all users                                 |
| `POST`       | `/api/users`                    | admin                                             | Create a user                                  |
| `PATCH`      | `/api/users/[id]`               | admin                                             | Update a user (incl. password reset, restore)  |
| `DELETE`     | `/api/users/[id]`               | admin                                             | Deactivate, or `?hard=1` to permanently delete |
| `GET`        | `/api/users/assignable`         | any signed-in                                     | Staff roster for owner pickers                 |
| `GET`        | `/api/profile`                  | any signed-in                                     | Own profile                                    |
| `PATCH`      | `/api/profile`                  | any signed-in                                     | Update own name / password                     |
| `GET`        | `/api/dashboard`                | admin, sales, ops                                 | Dashboard roll-up for a period                 |
| `GET`        | `/api/calendar`                 | admin, sales, ops                                 | Full-pipeline content calendar                 |
| `GET`        | `/api/audit`                    | admin                                             | Audit log, filtered                            |
| `GET`        | `/api/search?q=`                | admin, sales, ops                                 | Command-palette cross-module search            |
| `GET`        | `/api/settings`                 | any signed-in                                     | Company settings                               |
| `PATCH`      | `/api/settings`                 | admin                                             | Update company settings                        |
| `POST`       | `/api/documents/generate`       | admin, sales (all types); ops (kickoff, calendar) | Render or download a document                  |
| `POST`       | `/api/documents/proposal`       | admin, sales                                      | Single-card proposal                           |
| `GET`        | `/api/documents/ics?projectId=` | any signed-in                                     | Download `.ics` reminders                      |

---

### 9.1 Authentication — `/api/auth/[...nextauth]`

```ts
// src/app/api/auth/[...nextauth]/route.ts
export const { GET, POST } = handlers;
```

Mounts the standard NextAuth v5 endpoints. The ones this application uses:

| Endpoint                              | Method | Purpose                                                         |
| ------------------------------------- | ------ | --------------------------------------------------------------- |
| `/api/auth/callback/credentials`      | `POST` | Credential sign-in (called by `signIn()`)                       |
| `/api/auth/session`                   | `GET`  | Current session JSON (`useSession`)                             |
| `/api/auth/csrf`                      | `GET`  | CSRF token                                                      |
| `/api/auth/signout`                   | `POST` | Sign out; fires the `signOut` event → `auth.logout` audit entry |
| `/api/auth/providers`                 | `GET`  | Configured providers                                            |
| `/api/auth/signin`, `/api/auth/error` | `GET`  | Redirected to `/login` via `pages.signIn`                       |

Clients use `signIn` / `signOut` / `useSession` from `next-auth/react` rather than
calling these directly.

---

### 9.2 Projects

#### `GET /api/projects`

Lists non-archived projects, newest-updated first.

- **Roles:** all three (`project.read` is `all` for every role).
- **Scope:** every role sees all projects. Only a role whose read scope were `own`
  would be filtered to `ownerId`.
- **Projection:** list columns only — `projName`, `cName`, `partnerType`, `estNo`,
  `date`, `koEnd`, `ownerId`, `gstMode`, `updatedAt`. Terms, entity and notes are
  never sent to the list.
- **Item counts** come from one grouped aggregation, not a query per project.

**200 Response**

```json
[
  {
    "_id": "66f1…",
    "projName": "Zenvia Q3 Campaign",
    "cName": "Zenvia Healthcare Ltd.",
    "partnerType": "Receivable",
    "estNo": "ONF/EST/2026-27/0007",
    "date": "2026-07-14",
    "koEnd": "2026-10-30",
    "ownerId": "66e0…",
    "gstMode": "intra",
    "updatedAt": "2026-08-02T11:20:41.883Z",
    "itemCount": 6
  }
]
```

#### `POST /api/projects`

Creates a project. **201 Created.**

- **Roles:** admin (`all`), sales (`own` — becomes the owner). Ops → **403**.
- **Body:** any subset of the [Project schema](#project). Everything is optional;
  `projName` is required by the schema, so omitting it yields a 400 validation error.

**Server-applied values (cannot be supplied by the client):**

| Field                      | Source                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| `estNo`                    | Always minted server-side by `nextEstimateNo()` — a client-supplied number could collide. |
| `ownerId`                  | The calling user.                                                                         |
| `date`                     | Defaults to today (`toLocalISO()`) when blank.                                            |
| `validity`, `sac`, `terms` | Fall back to the admin Settings singleton, then to the hard-coded legacy defaults.        |
| `entity`                   | Snapshot of the ten `co*` fields from Settings, unless supplied.                          |

**Example request**

```json
{
  "projName": "Zenvia Q3 Campaign",
  "partnerType": "Receivable",
  "partnerId": "66e2…",
  "cName": "Zenvia Healthcare Ltd.",
  "cContact": "R. Menon, Brand Manager",
  "cEmail": "r.menon@zenviahealth.example",
  "cGstin": "27AAACZ4521K1ZP",
  "gstMode": "intra",
  "pos": "Maharashtra"
}
```

**201 Response** — the full created project document, including the minted `estNo`.

**Audit:** `project.create`.

#### `GET /api/projects/[id]`

One project plus **all** its line items, sorted by `sortOrder` then `createdAt`.

- **Roles:** all three.
- **404** with `{ "error": "Not found" }` when the id does not exist or the project
  is archived.

```json
{
  "project": { "_id": "66f1…", "projName": "…", "…": "…" },
  "items": [{ "_id": "66f2…", "section": "Daily Pulse", "…": "…" }]
}
```

> **Note:** `getProject` returns line items **without** `redactLineItemFor`. The
> project editor page does not use this path — it calls `listLineItems` separately,
> which does redact — but a direct call to this endpoint by an ops user returns
> commercial fields. See [§17](#17-behaviours-worth-knowing).

#### `PATCH /api/projects/[id]`

- **Roles:** admin (any project), sales (own only — otherwise 403 _"You can only
  modify your own projects."_), ops (any project, restricted fields).
- **Ops restriction:** the patch is rebuilt from `OPS_EDITABLE_PROJECT_FIELDS` only.
- **Always stripped, for every role:** `ownerId` (never reassignable by patch) and
  `estNo` (system-assigned; editing it would break uniqueness and let two projects
  claim the same number).
- Returns the updated document, or `null` if the id does not exist.

**Audit:** `project.update`, with a field-level diff and a human summary
(e.g. _"GST treatment: "intra" → "inter""_).

#### `DELETE /api/projects/[id]`

- **Roles:** admin only. Sales has `delete: false`; ops has no delete cell.
- **Cascade:** counts the project's line items, deletes them all
  (`LineItem.deleteMany`), then deletes the project. A **hard** delete — the
  `archived` flag is not used here.
- Returns `{ "ok": true }`, or `null` if the project did not exist.

**Audit:** `project.delete`. Because the cascade bypasses `deleteLineItem`, the
audit entry is the only record that those items existed — the count is taken
_before_ the delete and stored in both the label and `meta.itemCount`.

---

### 9.3 Line items

#### `GET /api/line-items?projectId=<id>`

| Param       | Required | Notes                                                                                                                             |
| ----------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `projectId` | yes      | Missing or empty yields an empty array (the query matches nothing). A malformed ObjectId raises a Mongoose `CastError` → **400**. |

- **Roles:** all three.
- **Ops:** each item is passed through `redactLineItemFor` — `rate`, `qty`,
  `discType`, `discValue`, `amountOverride`, `net`, `gross` and `disc` are absent.
- No ownership filter: every role reads every project's items.

#### `POST /api/line-items`

Creates a line item. **201 Created.**

- **Roles:** admin (`all`), sales (`own` — the parent project must be theirs, else
  403 _"You can only add items to your own projects."_), ops (`all`).
- **Body:** line-item fields **plus** `projectId`, which the route lifts out of the
  body and passes separately.
- Returns the created item, redacted for ops.

**Example**

```json
{
  "projectId": "66f1…",
  "section": "Daily Pulse",
  "name": "DP1 - Case Insight",
  "cardType": "Vertical Video",
  "promo": "Branded",
  "stream": "Live + DP",
  "produced": "OnfTV",
  "incl": "Card visible for 72 hours…",
  "excl": "Liaisoning with association…",
  "duration": "72 Hours",
  "status": "Planner",
  "qty": 1,
  "rate": 0,
  "discType": "amount",
  "discValue": 0,
  "amountOverride": "",
  "sortOrder": 3
}
```

**Audit:** `lineItem.create`.

#### `PATCH /api/line-items/[id]`

- **Roles:** admin, sales (parent project must be owned), ops (restricted to
  `OPS_EDITABLE_FIELDS`).
- `projectId` is always stripped — an item cannot be moved between projects by patch.
- Returns the updated item (redacted for ops), or `null` if not found.

**Audit:** `lineItem.update`, labelled with the diff and the item's topic or card name.

#### `DELETE /api/line-items/[id]`

- **Roles:** admin (`all`), sales (`own`). **Ops has no delete permission** — 403.
- Returns `{ "ok": true }`, or `null` if not found.

**Audit:** `lineItem.delete`. `meta` preserves `topic`, `cardName`, `section`,
`status`, `rate` and `qty` so a deleted item's commercials survive in the log.

#### `PATCH /api/line-items/bulk`

One round trip for a multi-row change, replacing the per-row request loop the
editor used to fire.

**Request**

```json
{ "ids": ["66f2…", "66f3…"], "patch": { "status": "In Progress" } }
```

- `ids` is coerced with `.map(String).filter(Boolean)`; a non-array yields `[]`.
- Permissions are enforced exactly as for a single row: for `scope === "own"` the
  distinct set of parent projects is resolved and **all** must be owned by the caller.
- Ops patches are reduced to `OPS_EDITABLE_FIELDS`; if nothing survives the filter,
  the call returns `{ "modified": 0 }` without writing.

**200 Response**

```json
{ "modified": 2 }
```

**Audit:** `lineItem.bulkUpdate`, with `resourceId` as the comma-joined id list.

#### `POST /api/line-items/bulk`

Bulk delete. The `op` discriminator exists so a future bulk operation can share
the route.

**Request**

```json
{ "op": "delete", "ids": ["66f2…", "66f3…"] }
```

- Any `op` other than `"delete"` → **400** `{ "error": "Unsupported operation" }`.
- **Roles:** admin, sales (own). Ops → 403.

**200 Response**

```json
{ "deleted": 2 }
```

**Audit:** `lineItem.bulkDelete`.

---

### 9.4 Partners

#### `GET /api/partners`

Non-archived partners, sorted by name.

- **Roles:** admin (all), sales (all — read scope is `all`). **Ops → 403**, it has
  no `partner` cell at all.

#### `POST /api/partners`

**201 Created.** `ownerId` is set to the caller.

**Body**

```json
{
  "name": "Zenvia Healthcare Ltd.",
  "type": "Receivable",
  "contact": "R. Menon, Brand Manager",
  "email": "r.menon@zenviahealth.example",
  "mobile": "+91 98200 41127",
  "gstin": "27AAACZ4521K1ZP",
  "addr": "Zenvia House, 4th Floor…"
}
```

**Side effect:** `recordContact()` files the contact into the directory. Any
`contactIntent` on the body is discarded — a brand-new partner has no history to
choose against.

**Audit:** `partner.create`.

#### `PATCH /api/partners/[id]`

- **Roles:** admin (any), sales (own only — _"You can only edit your own partners."_).
- `ownerId` is stripped.

**`contactIntent` (optional).** Not a partner field; it is lifted off the body
before the write and tells the contact directory what a changed contact name means:

```json
{
  "contact": "R. Menon, VP Marketing",
  "contactIntent": { "mode": "update", "contactId": "66e9…" }
}
```

| `mode`     | Meaning                                                                                                                                      |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `"update"` | The same person — correct the row already on record. No new row. `contactId` names which row; omitted means "the current one".               |
| `"new"`    | A handover — add a row and demote the previous person to history. A name already filed is still matched, so saving twice does not duplicate. |

Anything other than `"update"` or `"new"` is treated as no intent, which falls back
to name matching.

`recordContact` runs **only** when the patch touches `contact`, `email` or `mobile`
— an address-only save does not disturb the directory.

**Audit:** `partner.update`.

#### `DELETE /api/partners/[id]`

- **Roles:** admin only.
- Hard delete, plus `forgetPartnerContacts()` removing every directory row for
  that partner.
- Returns `{ "ok": true }`.

**Audit:** `partner.delete`, with the partner's name, type, email and GSTIN in `meta`.

---

### 9.5 Contacts

The directory of people at partners — the history behind each partner's current
`contact` field.

#### `GET /api/contacts`

- **Roles:** gated on `partner.read`, so admin and sales; **ops → 403**.
- Scope follows partner visibility exactly. Contacts are fetched only for partners
  the caller can see, then joined to their partner names in memory.
- Sorted `current` first, then by name.

**200 Response**

```json
[
  {
    "_id": "66e9…",
    "partnerId": "66e2…",
    "partnerName": "Zenvia Healthcare Ltd.",
    "name": "R. Menon, Brand Manager",
    "email": "r.menon@zenviahealth.example",
    "mobile": "+91 98200 41127",
    "current": true
  }
]
```

#### `DELETE /api/contacts/[id]`

Removes one directory row — for a contact filed by mistake.

- **Roles:** gated on `partner.update`; sales may only touch contacts of partners
  they own.
- **Refuses to delete the partner's _current_ contact** — 400:
  _"That is the partner's current contact. Save a new contact person instead — this
  one is then kept as history."_ That person is who the partner's projects and
  documents are addressed to; replacing them is done by saving a new contact.
- A nonexistent id returns `{ "ok": true }` (idempotent).

No audit entry is written for contact deletion.

---

### 9.6 Catalog (offerings)

#### `GET /api/catalog`

Active offerings only (`active: true`), sorted by `section`, `sortOrder`, `name`.

- **Roles:** all three (everyone reads the catalog).

#### `POST /api/catalog`

**201 Created.** **Admin only.**

```json
{
  "section": "Daily Pulse",
  "name": "DP12 - Expert Panel",
  "cardTypes": ["Horizontal Video"],
  "promo": ["Branded", "Non-Branded"],
  "stream": ["Live Only", "Live + DP"],
  "produced": ["OnfTV", "KOL"],
  "incl": "Card visible for 72 hours…",
  "excl": "Liaisoning with association…",
  "dev": "",
  "duration": "72 Hours"
}
```

`name` carries a unique index — a duplicate is a 400 (E11000).

**Audit:** `catalog.create`.

#### `PATCH /api/catalog/[id]`

Admin only. **Audit:** `catalog.update`.

#### `DELETE /api/catalog/[id]`

Admin only. **Soft delete** — sets `active: false` rather than removing the row, so
historical line items that copied its scope are never broken.

Returns `{ "ok": true }`. **Audit:** `catalog.delete`, labelled
_"Retired offering "X" (deactivated, not erased)"_.

---

### 9.7 Users

All admin-only, except `/api/users/assignable`.

#### `GET /api/users`

Every user including deactivated ones, sorted by role then username.
`passwordHash` is excluded via `.select("-passwordHash")`.

#### `POST /api/users`

**201 Created.** The route reads fields **by name** rather than spreading the body.

```json
{
  "username": "priya",
  "name": "Priya Nair",
  "email": "priya@onference.in",
  "role": "sales",
  "password": "…"
}
```

- `username` is lowercased and trimmed; unique index.
- `email` is checked for uniqueness first, for a readable message
  (_""x@y" is already the email on "someuser"."_); the partial unique index on the
  collection is the backstop against a race.
- `password` is bcrypt-hashed at cost 10. **No minimum length is enforced here** —
  only self-service password changes require 8 characters.
- Response excludes `passwordHash`.

**Audit:** `user.create`.

#### `PATCH /api/users/[id]`

Accepts `name`, `email`, `role`, `active`, `password`. Anything else is ignored —
the service copies a fixed key list.

- `password` present → re-hashed into `passwordHash` (an admin password reset; no
  current-password check).
- `active: true` is how the Users screen **restores** a deactivated account.
- Email uniqueness is re-checked, excluding this id.

**Audit:** `user.update`. The hash never enters the log; the _fact_ of a reset does
(`meta.passwordReset`).

#### `DELETE /api/users/[id]`

Two modes, selected by query string.

**Mode 1 — deactivate (default).** No query parameters.

- Sets `active: false`. Reversible from the Deleted tab. Everything the account owns
  keeps an owner that resolves.
- Refuses self-deletion: _"You cannot delete your own account."_
- Returns the updated user document.
- **Audit:** `user.deactivate`.

**Mode 2 — permanent delete.** `?hard=1`, optionally `&reassignTo=<userId>`.

| Param        | Notes                                                |
| ------------ | ---------------------------------------------------- |
| `hard`       | Must be exactly `1`, otherwise mode 1 applies.       |
| `reassignTo` | Optional. The user id inheriting every owned record. |

Guards:

| Condition                      | Result                                                                                    |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| Deleting yourself              | 403 _"You cannot delete your own account."_                                               |
| Target is an **admin**         | 403 _"Administrators cannot be deleted. Change their role first if the account must go."_ |
| Target does not exist          | 400 _"That account no longer exists."_                                                    |
| `reassignTo` equals the target | 400 _"An account cannot inherit its own records."_                                        |
| Heir does not exist            | 400 _"The colleague you picked no longer exists."_                                        |
| Heir is deactivated            | 400 _""x" is deactivated and cannot take on new records."_                                |

An admin cannot delete another admin because administrators are the people who hold
this button — letting them remove each other turns one compromised account into the
loss of every other. Removing an admin means demoting them first, a deliberate
second step that is itself logged.

With `reassignTo`, these five ownership links are rewritten before the delete:

| Collection          | Field         |
| ------------------- | ------------- |
| `Project`           | `ownerId`     |
| `Partner`           | `ownerId`     |
| `Proposal`          | `ownerId`     |
| `Contact`           | `ownerId`     |
| `GeneratedDocument` | `generatedBy` |

Without it, the records are left untouched and keep an owner id that no longer
resolves — they stay visible to admin and ops but drop out of any "own records only"
scope. That is a real consequence, which is why it is chosen rather than defaulted to.

**200 Response**

```json
{ "ok": true, "username": "priya", "moved": 14, "reassignedTo": "arjun" }
```

**Audit:** `user.delete`. Audit entries copy in `actorName` and `actorRole` at write
time, so what a deleted person did stays readable after their row is gone.

#### `GET /api/users/assignable`

The staff roster behind the Account owner and Production owner pickers.

- **Roles:** **any signed-in user.** Deliberately _not_ gated on
  `can(…, "user", "read")` — that permission governs user _administration_
  (logins, emails, account creation) and only admin holds it. Sales and ops are the
  people who fill a project in, so gating the roster on it would leave their pickers
  empty.
- What leaves the server is narrowed to what a picker needs: `name` and `role`.
  **No username, no email, never the password hash.**
- `active: true` only, so a closed account cannot be assigned new work.
- Sorted by name.

```json
[{ "_id": "66e0…", "name": "Arjun Rao", "role": "sales" }]
```

---

### 9.8 Profile

The signed-in user's own record. No role check — both services are scoped to the
caller's own row, so there is nothing here another user could reach.

#### `GET /api/profile`

```json
{
  "_id": "66e0…",
  "name": "Arjun Rao",
  "username": "arjun",
  "email": "arjun@onference.in",
  "role": "sales",
  "active": true
}
```

#### `PATCH /api/profile`

The route names each accepted field one by one and never spreads the body — a
spread would let `role` ride along and any signed-in user promote themselves with a
hand-rolled request.

| Field             | Accepted | Notes                                                                                                                                                                                                                                                                                |
| ----------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `name`            | yes      | Trimmed. Blank → 400 _"Your name cannot be blank."_                                                                                                                                                                                                                                  |
| `currentPassword` | yes      | Required when changing the password.                                                                                                                                                                                                                                                 |
| `newPassword`     | yes      | Minimum 8 characters.                                                                                                                                                                                                                                                                |
| `email`           | **no**   | Deliberately not read. Email signs people in alongside the username, so changing it changes a credential — someone editing it to a colleague's address would be taking over how that colleague signs in. An administrator sets it, where the uniqueness check and audit trail apply. |
| `role`, `active`  | **no**   | Unreachable here by construction.                                                                                                                                                                                                                                                    |

A password change re-verifies `currentPassword` with bcrypt first: a signed-in
session left open on a shared desk should not be enough to lock the owner out.

| Error                                                | Cause                              |
| ---------------------------------------------------- | ---------------------------------- |
| `"Your new password must be at least 8 characters."` | `newPassword.length < 8`           |
| `"Your current password is not correct."`            | bcrypt mismatch                    |
| `"Your account could not be found."`                 | Row removed underneath the session |

An empty patch is a no-op that returns the current profile.

**Audit:** `profile.update`, with `meta.passwordChanged`. The hash never enters the log.

> After saving a name, the client calls `useSession().update({ name })` so the JWT
> — and therefore the top bar — reflects the change without a re-login.

---

### 9.9 Dashboard

#### `GET /api/dashboard`

| Query param | Values                                                     | Default |
| ----------- | ---------------------------------------------------------- | ------- |
| `period`    | `all` · `today` · `7d` · `30d` · `month` · `fy` · `custom` | `all`   |
| `from`      | `yyyy-mm-dd` — only with `period=custom`                   | —       |
| `to`        | `yyyy-mm-dd` — only with `period=custom`                   | —       |

Unknown keys fall back to all time, and `custom` with neither end does too, so a
hand-edited URL can never produce an empty dashboard by accident. `fy` resolves to
the Indian financial year, 1 April – 31 March.

The window applies to the project's own **document date** (`date`). A project with
no date cannot be placed in time, so it drops out of any dated window — the count is
surfaced as `undatedCount` so the exclusion is visible rather than silent.

**Scope:** sales sees only projects they own (`dashboard.read` is `own`); admin and
ops see all.

**200 Response**

```json
{
  "role": "sales",
  "projectCount": 12,
  "itemCount": 87,
  "statusCounts": {
    "Planner": 30,
    "In Progress": 24,
    "Done": 28,
    "Cancelled": 5
  },
  "sectionCounts": {
    "Daily Pulse": 51,
    "Exclusive Members Access (EMA)": 22,
    "Media Services": 14
  },
  "upcoming": [
    {
      "projectId": "66f1…",
      "project": "Zenvia Q3 Campaign",
      "item": "Diabetes Care Panel",
      "kind": "Release",
      "date": "2026-09-21",
      "overdue": false
    }
  ],
  "overdueCount": 3,
  "periodLabel": "This financial year",
  "undatedCount": 1,
  "revenueInFlight": 1450000,
  "revenueWon": 920000,
  "partnerCount": 18
}
```

| Field             | Meaning                                                                                                                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `statusCounts`    | All four statuses always present, zero-filled.                                                                                                                                                                                              |
| `upcoming`        | Milestone dates within the next **14 days** (including already-passed ones) on items **not** `Done` or `Cancelled`. Five milestone kinds: `Record`, `Release`, `Card end`, `Video end`, `Brand end`. Sorted by date, **capped at 30 rows**. |
| `overdueCount`    | Rows in `upcoming` whose date is before today. Counted before the 30-row cap is applied to `upcoming`.                                                                                                                                      |
| `revenueInFlight` | Net (pre-GST) value of items neither `Done` nor `Cancelled`.                                                                                                                                                                                |
| `revenueWon`      | Net (pre-GST) value of items marked `Done`.                                                                                                                                                                                                 |
| `partnerCount`    | Non-archived partners — for sales, only their own. Not period-bound: partners are a standing list.                                                                                                                                          |

**The last three keys are absent entirely for ops** (`canSeeMoney` is false), and
the commercial fields are not even projected out of Mongo for an ops request.

---

### 9.10 Calendar

#### `GET /api/calendar`

The full cross-project content pipeline. No parameters.

- **Roles:** all three.
- **Ops:** every card passes through `redactLineItemFor`; the returned shape carries
  no commercial fields regardless.
- Projected to only the fields the board renders — the inclusion/exclusion scope text
  is large and unused here.
- Sorted by `relDate` then `recDate`.

```json
{
  "kanban": {
    "Planner": [ … ],
    "In Progress": [ … ],
    "Done": [ … ],
    "Cancelled": [ … ]
  },
  "cards": [
    {
      "id": "66f2…",
      "projectId": "66f1…",
      "project": "Zenvia Q3 Campaign",
      "topic": "Diabetes Care Panel",
      "name": "DP2 - CME - 1 Hr",
      "section": "Daily Pulse",
      "status": "In Progress",
      "recDate": "2026-09-10",
      "relDate": "2026-09-21",
      "cardEnd": "2026-09-24",
      "videoEnd": "2026-12-21",
      "brandEnd": ""
    }
  ]
}
```

`kanban` is the same cards keyed by status; all four columns are always present.
Any unexpected status value creates its own column on the fly.

---

### 9.11 Audit log

#### `GET /api/audit`

**Admin only.** The guard lives in the service (`assertCanRead`), so the route and
the server-rendered page enforce it from the same place — and a direct call by a
non-admin lands in the log as `auth.denied`.

**Two modes.**

**Mode 1 — project history.** `?projectId=<id>` (takes precedence over every other
parameter).

Returns everything that touched one project: the project row itself _plus_ the line
items and documents carrying its id, via
`$or: [{ resource: "project", resourceId: id }, { projectId: id }]`.
Limit fixed at **100** (service cap 500). Served by the `projectId` index.

**Mode 2 — filtered log.**

| Query param | Notes                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------ |
| `actorId`   | Exact user id                                                                              |
| `resource`  | `project` · `lineItem` · `partner` · `catalog` · `user` · `settings` · `document` · `auth` |
| `action`    | e.g. `project.update`, `auth.login.failed`                                                 |
| `from`      | `yyyy-mm-dd` → `createdAt >= fromT00:00:00.000Z`                                           |
| `to`        | `yyyy-mm-dd` → `createdAt <= toT23:59:59.999Z`                                             |
| `limit`     | Default 500, **hard-capped at 2000**                                                       |

Sorted newest first.

> Date filtering is anchored to **UTC** midnight, while the dates stored on projects
> and line items are local `yyyy-mm-dd` strings. For India (UTC+5:30) an audit
> `from`/`to` boundary therefore sits 5½ hours off local midnight.

**200 Response**

```json
[
  {
    "_id": "6702…",
    "actorId": "66e0…",
    "actorName": "Arjun Rao",
    "actorRole": "sales",
    "action": "project.update",
    "resource": "project",
    "resourceId": "66f1…",
    "projectId": "66f1…",
    "label": "GST treatment: \"intra\" → \"inter\"",
    "meta": {
      "projName": "Zenvia Q3 Campaign",
      "changed": { "gstMode": ["intra", "inter"] }
    },
    "createdAt": "2026-08-02T11:20:41.883Z",
    "updatedAt": "2026-08-02T11:20:41.883Z"
  }
]
```

The distinct-actor list for the filter dropdown comes from `listAuditActors()`,
called by the server page rather than exposed as an endpoint.

**Complete action catalogue**

| Resource   | Actions                                                                                                               |
| ---------- | --------------------------------------------------------------------------------------------------------------------- |
| `project`  | `project.create`, `project.update`, `project.delete`                                                                  |
| `lineItem` | `lineItem.create`, `lineItem.update`, `lineItem.delete`, `lineItem.bulkUpdate`, `lineItem.bulkDelete`                 |
| `partner`  | `partner.create`, `partner.update`, `partner.delete`                                                                  |
| `catalog`  | `catalog.create`, `catalog.update`, `catalog.delete`                                                                  |
| `user`     | `user.create`, `user.update`, `user.deactivate`, `user.delete`, `profile.update`                                      |
| `settings` | `settings.update`                                                                                                     |
| `document` | `document.estimate`, `document.kickoff`, `document.invoice`, `document.calendar`, `document.proposal`, `document.ics` |
| `auth`     | `auth.login`, `auth.logout`, `auth.login.failed`, `auth.denied`                                                       |

`project.estimateNo` has a display label in `audit.labels.ts` but no emitter in the
current code — a leftover from the legacy numbering flow.

---

### 9.12 Search

#### `GET /api/search?q=<term>`

Cross-module lookup for the command palette (Ctrl/Cmd-K).

- Terms shorter than **2 characters** return `[]` immediately.
- The term is **regex-escaped** before it reaches a `RegExp`, then matched
  case-insensitively. User input is never compiled into a pattern raw.
- Each module is queried **only if** the caller's role may read it, and results link
  into that role's own area (`/<role>/…`).
- **Up to 6 hits per group**, three groups, so at most 18 results.

| Group      | Searched fields                             | Link                                                  |
| ---------- | ------------------------------------------- | ----------------------------------------------------- |
| `Projects` | `projName`, `cName`, `estNo` (non-archived) | `/<role>/projects/<id>`                               |
| `Partners` | `name`, `email` (non-archived)              | `/<role>/partners?focus=<id>`                         |
| `Content`  | `topic`, `cardName`, `name`                 | `/<role>/projects/<projectId>?tab=content&focus=<id>` |

`?focus=` tells the destination list which row to page to and highlight, so the
search does not have to be repeated on arrival.

```json
[
  {
    "id": "66f1…",
    "group": "Projects",
    "title": "Zenvia Q3 Campaign",
    "meta": "Zenvia Healthcare Ltd. · ONF/EST/2026-27/0007",
    "href": "/sales/projects/66f1…"
  }
]
```

For ops the `Partners` group is skipped entirely (no `partner.read`).

---

### 9.13 Settings

The company / issuing-entity singleton, keyed `{ key: "company" }`. `getSettings()`
creates it on first read if absent, so this endpoint never 404s.

#### `GET /api/settings`

Returns the settings document.

> **No role check.** Any signed-in user, including ops, can read the company
> settings — GSTIN, PAN, TAN, bank details. See [§17](#17-behaviours-worth-knowing).

#### `PATCH /api/settings`

**Admin only** (`settings.update`). `key` is stripped so the singleton cannot be
renamed. Upserts, so a missing document is created.

```json
{
  "coName": "Onference Training Technologies LLP",
  "coGstin": "27AAEFO9993N1Z7",
  "coBank": "HDFC Bank, A/c 50200…, IFSC HDFC0000123",
  "defaultTerms": "100% advance against this estimate…",
  "defaultSac": "998365",
  "defaultValidity": "15"
}
```

These values seed every **new** project's `entity` snapshot, `terms`, `sac` and
`validity`. Existing projects are unaffected — they carry their own snapshot.

**Audit:** `settings.update`.

---

### 9.14 Documents

Four document types plus a proposal flow and an `.ics` export. All are rendered as
Word-compatible HTML; the `.doc` responses are prefixed with a UTF-8 BOM (`﻿`)
so Word opens them in the right encoding.

#### Generation permissions

```ts
const DOC_PERMISSIONS = {
  estimate: ["admin", "sales"],
  invoice: ["admin", "sales"],
  calendar: ["admin", "sales", "ops"],
  kickoff: ["admin", "sales", "ops"],
};
```

Ops gets production documents only — it is commercial-blind.

#### `POST /api/documents/generate`

**Request**

```json
{
  "projectId": "66f1…",
  "type": "estimate",
  "mode": "word",
  "calView": "calendar",
  "calMonth": "2026-09"
}
```

| Field       | Values                                          | Notes                                                                                                    |
| ----------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `projectId` | ObjectId string                                 | Required. Unknown id → 400 _"Project not found"_.                                                        |
| `type`      | `estimate` · `kickoff` · `invoice` · `calendar` | Checked against `DOC_PERMISSIONS`; a disallowed type → 403 _"Your role cannot generate a X document."_   |
| `mode`      | `preview` · `word`                              | Anything other than `"preview"` is treated as `"word"` — **`word` is the default**.                      |
| `calView`   | `kanban` · `calendar`                           | Calendar type only. Anything other than `"calendar"` → `kanban`.                                         |
| `calMonth`  | `yyyy-mm`                                       | Calendar type only. Defaults to the earliest release/record date on the project, else the current month. |

**Responses**

| Mode      | Status | Content-Type                                                                          | Body                                                                                                              |
| --------- | ------ | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `preview` | 200    | `text/html; charset=utf-8`                                                            | On-screen HTML, A4 landscape print rules, interactive Propose buttons live. **No audit entry, no stored record.** |
| `word`    | 200    | `application/msword; charset=utf-8` + `Content-Disposition: attachment; filename="…"` | BOM-prefixed MSO landscape `WordSection1` document. Writes a `GeneratedDocument` row and an audit entry.          |

**Filename pattern**

```
OnferenceTV_<type>_<partner>_<project>[_<yyyy-mm>][_<estNo>].doc
```

Each part is slugified — non-alphanumerics collapsed to `-`, truncated to 40 chars.
The month part appears for calendars only.

**On a `word` generation** a `GeneratedDocument` row is stored with the document
number and a totals snapshot (`{ total, itemCount }`) for reproducibility, and an
audit entry `document.<type>` is written.

**Preview → Propose bridge.** The preview HTML carries a small script: a click on a
`[data-prop]` button `postMessage`s `{ onfPropose: <lineItemId> }` up to the parent
window. `DocPreview` verifies the message came from its own iframe before opening
the Propose modal. Those buttons are omitted from the `word` render.

#### `POST /api/documents/proposal`

A single-card estimate, priced independently of the project — the legacy "Propose"
flow.

**Request**

```json
{
  "projectId": "66f1…",
  "lineItemId": "66f2…",
  "mode": "preview",
  "gstMode": "intra",
  "partner": {
    "name": "Zenvia Healthcare Ltd.",
    "type": "Receivable",
    "contact": "R. Menon",
    "email": "r.menon@zenviahealth.example",
    "mobile": "+91 98200 41127",
    "gstin": "27AAACZ4521K1ZP",
    "addr": "Zenvia House…"
  },
  "override": {
    "qty": 2,
    "rate": 75000,
    "discType": "percent",
    "discValue": 10
  }
}
```

| Field      | Notes                                                                                                                                   |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `mode`     | Anything other than `"word"` → `"preview"`. **Opposite default to `/generate`.**                                                        |
| `gstMode`  | Anything other than `"inter"` → `"intra"`.                                                                                              |
| `partner`  | Overrides the project's partner snapshot on this document only. Nothing is written back to the project or the Partner collection.       |
| `override` | `qty`, `rate`, `discType`, `discValue`. Supplying an override **replaces the stored `amountOverride` entirely**, as in the legacy flow. |

- **Roles:** gated on `estimate` permission — admin and sales. Ops → 403
  _"Your role cannot generate a proposal."_
- A `lineItemId` not on that project → 400 _"That line item is no longer on this project."_
- Rendered with the **estimate** template, always with `isProposal: true`, which
  suppresses the document-level discount row. A proposal quotes only its own line:
  `docDiscValue` is forced to `0`.
- Document number is the project's estimate number plus `-P<last 6 chars of the
line item id>`, e.g. `ONF/EST/2026-27/0007-P4b81c3`.
- Filename: `OnferenceTV_Proposal_<partner>_<project>.doc`.

**On `mode: "word"`** a `Proposal` row is persisted (ids, GST mode, override,
partner snapshot, owner) and a `document.proposal` audit entry is written.

#### `GET /api/documents/ics?projectId=<id>`

Downloads the calendar-reminder file.

- **Content-Type:** `text/calendar; charset=utf-8`, as an attachment named
  `OnferenceTV_Reminders_<project>.ics`.
- One all-day `VEVENT` per **end date** across the project — `cardEnd`, `videoEnd`,
  `brandEnd` per item, plus project-wide `koContract` and `koEnd` — spanning the two
  days before through the date itself, with a `DISPLAY` `VALARM` at 09:00 UTC on
  each of those three days. This is the legacy tool's reminder rule exactly.
- Organiser and attendee are the project entity's `coEmail`, falling back to
  `admin@onference.in`.
- Lines are folded at 75 octets per RFC 5545; commas, semicolons, backslashes and
  newlines are escaped.
- A project with no end dates yields a valid but empty calendar — the client checks
  for a body under 60 bytes and reports _"No end dates set yet"_ instead of
  downloading.

> **This endpoint performs no role check** — `generateICS` does not call
> `canGenerate`. Any signed-in user can download reminders for any project. The file
> contains no pricing. See [§17](#17-behaviours-worth-knowing).

## **Audit:** `document.ics`.

## 10. Data models

Nine Mongoose collections. Every schema carries `{ timestamps: true }`, so
`createdAt` and `updatedAt` exist on every document.

### The hot-reload guard

Every model file ends with the same pattern:

```ts
if (process.env.NODE_ENV !== "production" && models.Project) {
  mongoose.deleteModel("Project");
}
export const Project = (models.Project ||
  model("Project", projectSchema)) as Model<any>;
```

A dev server keeps the compiled model on the Mongoose singleton across hot reloads,
so a schema change would otherwise have no effect until a full restart — Mongoose
silently strips the unknown keys on write instead. In development the model is
recompiled; in production it is compiled once.

### Connection — `src/lib/db.ts`

`connectDB()` caches both the connection and the in-flight promise on
`globalThis._mongoose`, so hot reloads and concurrent requests share one connection
pool. `bufferCommands: false` — a query issued before the connection is up fails
fast rather than queueing invisibly. Throws immediately if `MONGODB_URI` is unset.

---

### Project

`src/features/projects/project.model.ts` — collection `projects`

| Field          | Type               | Default           | Notes                                                                     |
| -------------- | ------------------ | ----------------- | ------------------------------------------------------------------------- |
| `projName`     | String             | —                 | **Required**, trimmed                                                     |
| `partnerType`  | String             | `"Receivable"`    | enum: `Receivable` · `Payable` · `Barter`                                 |
| `partnerId`    | ObjectId → Partner | —                 | Link to the reusable partner record                                       |
| `cName`        | String             | `""`              | Partner name — **snapshot**                                               |
| `cContact`     | String             | `""`              | Contact person — snapshot                                                 |
| `cEmail`       | String             | `""`              | snapshot                                                                  |
| `cMobile`      | String             | `""`              | snapshot                                                                  |
| `cAddr`        | String             | `""`              | snapshot                                                                  |
| `cGstin`       | String             | `""`              | snapshot                                                                  |
| `date`         | String             | `""`              | `yyyy-mm-dd`. Document date; drives the estimate FY and dashboard windows |
| `estNo`        | String             | `""`              | System-minted, e.g. `ONF/EST/2026-27/0001`                                |
| `validity`     | String             | `"15"`            | Days                                                                      |
| `pos`          | String             | `""`              | Place of supply                                                           |
| `cPo`          | String             | `""`              | Partner purchase order                                                    |
| `gstMode`      | String             | `"intra"`         | enum: `intra` (CGST+SGST) · `inter` (IGST)                                |
| `sac`          | String             | `"998365"`        | Service accounting code                                                   |
| `terms`        | String             | legacy terms text |                                                                           |
| `docDiscType`  | String             | `"amount"`        | enum: `amount` · `percent`                                                |
| `docDiscValue` | Number             | `0`               | Document-level discount                                                   |
| `koStart`      | String             | `""`              | Kick-off: project start (`yyyy-mm-dd`)                                    |
| `koEnd`        | String             | `""`              | Project end — generates an `.ics` reminder                                |
| `koContract`   | String             | `""`              | Contract end — generates an `.ics` reminder                               |
| `koOwner`      | String             | `""`              | Account owner (a **name string**, not a reference)                        |
| `koProducer`   | String             | `""`              | Production owner (name string)                                            |
| `koNotes`      | String             | `""`              |                                                                           |
| `entity`       | Sub-doc            | from Settings     | Issuing-entity snapshot, `_id: false`                                     |
| `ownerId`      | ObjectId → User    | —                 | **Required**, indexed                                                     |
| `archived`     | Boolean            | `false`           | Soft-delete flag; every list filters `archived: false`                    |

**`entity` sub-document** — ten fields, each defaulting from `COMPANY_DEFAULTS`:
`coName`, `coGstin`, `coLlpin`, `coPan`, `coTan`, `coMsme`, `coAddr`, `coEmail`,
`coSite`, `coBank`.

Snapshotting the entity per project means a later change to company settings never
rewrites the letterhead on an already-issued document.

**Indexes**

```
{ ownerId: 1 }                              (field-level)
{ archived: 1, updatedAt: -1 }              list views, newest first
{ ownerId: 1, archived: 1, updatedAt: -1 }  owner-scoped lists
```

---

### LineItem

`src/features/line-items/line-item.model.ts` — collection `lineitems`

Referenced, **not embedded**, so ops can query line items across all projects for
the shared content calendar without loading every project.

| Field            | Type               | Default     | Notes                                                                             |
| ---------------- | ------------------ | ----------- | --------------------------------------------------------------------------------- |
| `projectId`      | ObjectId → Project | —           | **Required**, indexed                                                             |
| `section`        | String             | —           | **Required**. `Daily Pulse` · `Exclusive Members Access (EMA)` · `Media Services` |
| `name`           | String             | —           | **Required**. The offering name, copied from the catalog                          |
| `topic`          | String             | `""`        | DP/EMA only; blank prints "To Be Decided"                                         |
| `projDesc`       | String             | `""`        | Media Services carries this instead of a topic                                    |
| `status`         | String             | `"Planner"` | enum: `Planner` · `In Progress` · `Done` · `Cancelled`. Indexed                   |
| `cardType`       | String             | `""`        |                                                                                   |
| `promo`          | String             | `""`        | `Branded` / `Non-Branded`                                                         |
| `stream`         | String             | `""`        |                                                                                   |
| `produced`       | String             | `""`        | `OnfTV` / `Customer` / `KOL` / …                                                  |
| `incl`           | String             | `""`        | Inclusions — the agreed scope. **Not ops-editable**                               |
| `excl`           | String             | `""`        | Exclusions. **Not ops-editable**                                                  |
| `dev`            | String             | `""`        | Deviations                                                                        |
| `duration`       | String             | `""`        | e.g. `"72 Hours"`, `"90 Days"`                                                    |
| `qty`            | Number             | `1`         | **Commercial** — hidden from ops                                                  |
| `rate`           | Number             | `0`         | **Commercial**                                                                    |
| `amountOverride` | Mixed              | `""`        | **Commercial**. `""` means "compute from qty × rate"                              |
| `discType`       | String             | `"amount"`  | **Commercial**. enum: `amount` · `percent`                                        |
| `discValue`      | Number             | `0`         | **Commercial**                                                                    |
| `cardName`       | String             | `""`        | Production card label                                                             |
| `recDate`        | String             | `""`        | Recording date                                                                    |
| `relDate`        | String             | `""`        | Release date                                                                      |
| `cardEnd`        | String             | `""`        | Card end — `.ics` reminder                                                        |
| `videoEnd`       | String             | `""`        | Video end — `.ics` reminder                                                       |
| `brandEnd`       | String             | `""`        | Branding end — `.ics` reminder                                                    |
| `sortOrder`      | Number             | `0`         | Display order within a project                                                    |

`amountOverride` is `Schema.Types.Mixed` because the legacy tool used `""` as the
"not set" sentinel and a number otherwise; `calcLine` treats `""`, `null` and
`undefined` alike.

**Indexes** — matching the query shapes actually used:

```
{ projectId: 1 }                            (field-level)
{ status: 1 }                               (field-level)
{ projectId: 1, sortOrder: 1, createdAt: 1 }  items of a project in display order
{ relDate: 1 }                                cross-project calendar
{ status: 1, relDate: 1 }                     dashboard roll-ups by status
```

---

### User

`src/features/users/user.model.ts` — collection `users`

| Field          | Type    | Default | Notes                                                               |
| -------------- | ------- | ------- | ------------------------------------------------------------------- |
| `username`     | String  | —       | **Required**, **unique**, lowercased, trimmed. A sign-in credential |
| `name`         | String  | —       | **Required**, trimmed. Display name                                 |
| `email`        | String  | —       | Trimmed, lowercased. Also a sign-in credential                      |
| `passwordHash` | String  | —       | **Required**, `select: false` — excluded from ordinary reads        |
| `role`         | String  | —       | **Required**. enum: `admin` · `sales` · `ops`                       |
| `active`       | Boolean | `true`  | `false` = deactivated; cannot sign in, restorable                   |

**Indexes**

```
{ username: 1 }  unique
{ email: 1 }     unique, partialFilterExpression: { email: { $gt: "" } }
```

The email index is **partial** because accounts without an email store `""`, and a
plain unique index would allow only one such account to exist. Email is a sign-in
credential alongside username, so two accounts must never share one.

---

### Partner

`src/features/partners/partner.model.ts` — collection `partners`

| Field      | Type            | Default        | Notes                                     |
| ---------- | --------------- | -------------- | ----------------------------------------- |
| `name`     | String          | —              | **Required**, trimmed                     |
| `type`     | String          | `"Receivable"` | enum: `Receivable` · `Payable` · `Barter` |
| `contact`  | String          | `""`           | The **current** contact person            |
| `email`    | String          | `""`           |                                           |
| `mobile`   | String          | `""`           |                                           |
| `gstin`    | String          | `""`           |                                           |
| `addr`     | String          | `""`           |                                           |
| `ownerId`  | ObjectId → User | —              | **Required**, indexed                     |
| `archived` | Boolean         | `false`        | Soft-delete flag                          |

**Indexes**

```
{ ownerId: 1 }                (field-level)
{ archived: 1, name: 1 }
{ ownerId: 1, archived: 1 }
```

---

### Contact

`src/features/contacts/contact.model.ts` — collection `contacts`

One person's association with one partner. Partner still carries
`contact`/`email`/`mobile` as the _present_ contact, because every document and
every project snapshot reads those three fields; this collection is the history
behind them.

| Field       | Type               | Default | Notes                                                                                                                            |
| ----------- | ------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `partnerId` | ObjectId → Partner | —       | **Required**                                                                                                                     |
| `name`      | String             | —       | **Required**, trimmed. As typed, e.g. `"R. Menon, Brand Manager"` — one field, matching the single `cContact` string on projects |
| `email`     | String             | `""`    |                                                                                                                                  |
| `mobile`    | String             | `""`    |                                                                                                                                  |
| `current`   | Boolean            | `true`  | At most one row per partner holds this                                                                                           |
| `ownerId`   | ObjectId → User    | —       | Optional                                                                                                                         |

Someone who moves companies gets a **second row**, not an edited one — one row per
person-at-a-company, never a person edited across companies. So the partner they
left still shows who used to be there, and the person can be found again at their
new company.

**Indexes**

```
{ partnerId: 1, current: -1, name: 1 }  a partner's own people, current first
{ name: 1 }                              everyone else, searched by name
```

---

### Offering (catalog)

`src/features/catalog/offering.model.ts` — collection `offerings`

| Field       | Type     | Default | Notes                                            |
| ----------- | -------- | ------- | ------------------------------------------------ |
| `section`   | String   | —       | **Required**, indexed                            |
| `name`      | String   | —       | **Required**, **unique**                         |
| `cardTypes` | [String] | `[]`    | Selectable card types                            |
| `promo`     | [String] | `[]`    |                                                  |
| `stream`    | [String] | `[]`    |                                                  |
| `produced`  | [String] | `[]`    |                                                  |
| `incl`      | String   | `""`    | Default inclusions copied onto new line items    |
| `excl`      | String   | `""`    | Default exclusions                               |
| `dev`       | String   | `""`    |                                                  |
| `duration`  | String   | `""`    |                                                  |
| `active`    | Boolean  | `true`  | Soft delete — retired offerings stay for history |
| `sortOrder` | Number   | `0`     |                                                  |

**Indexes**

```
{ section: 1 }  (field-level)
{ name: 1 }     unique
{ active: 1, section: 1, sortOrder: 1 }
```

**Seed catalog** — 21 offerings in `src/lib/catalog-seed-data.ts`:
11 Daily Pulse, 3 EMA, 7 Media Services.

---

### Settings

`src/features/settings/settings.model.ts` — collection `settings`

A singleton keyed `{ key: "company" }` (unique). Created on first read.

| Field             | Default                                                        |
| ----------------- | -------------------------------------------------------------- |
| `key`             | `"company"` — unique                                           |
| `coName`          | `"Onference Training Technologies LLP"`                        |
| `coGstin`         | `"27AAEFO9993N1Z7"`                                            |
| `coLlpin`         | `"AAG-8842"`                                                   |
| `coPan`           | `"AAEFO9993N"`                                                 |
| `coTan`           | `"MUMO07434A"`                                                 |
| `coMsme`          | `""`                                                           |
| `coAddr`          | `"G-18, HiLife Mall, PM Road, Santacruz (W), Mumbai – 400054"` |
| `coEmail`         | `"admin@onference.in"`                                         |
| `coSite`          | `"www.onference.tv"`                                           |
| `coBank`          | `""`                                                           |
| `defaultTerms`    | The legacy terms paragraph                                     |
| `defaultSac`      | `"998365"`                                                     |
| `defaultValidity` | `"15"`                                                         |

---

### AuditLog

`src/features/audit/audit-log.model.ts` — collection `auditlogs`

| Field        | Type            | Default | Notes                                                                                                              |
| ------------ | --------------- | ------- | ------------------------------------------------------------------------------------------------------------------ |
| `actorId`    | ObjectId → User | —       | **Optional** — a failed sign-in against an unknown username has no actor to point at                               |
| `actorName`  | String          | `""`    | **Snapshot**, not a lookup                                                                                         |
| `actorRole`  | String          | `""`    | **Snapshot** — promote someone from sales to admin and the log must still say what they were when they acted       |
| `action`     | String          | —       | **Required**, e.g. `project.create`                                                                                |
| `resource`   | String          | —       | **Required**                                                                                                       |
| `resourceId` | String          | `""`    | Bulk operations store a comma-joined id list                                                                       |
| `projectId`  | String          | `""`    | Lets one query answer "everything that happened to this project", including its line items and generated documents |
| `label`      | String          | `""`    | Pre-rendered summary, so the table is scannable without expanding rows                                             |
| `meta`       | Mixed           | `{}`    | Field diffs and contextual detail                                                                                  |

**Indexes**

```
{ createdAt: -1 }
{ resource: 1, resourceId: 1 }
{ projectId: 1, createdAt: -1 }
{ actorId: 1, createdAt: -1 }
{ action: 1, createdAt: -1 }
```

Actor identity is denormalised on purpose: the log stays readable after a user row
is permanently deleted.

---

### GeneratedDocument

`src/features/documents/generated-document.model.ts` — collection `generateddocuments`

Written only on a **`word`-mode** generation, never on a preview.

| Field         | Type               | Notes                                                                            |
| ------------- | ------------------ | -------------------------------------------------------------------------------- |
| `projectId`   | ObjectId → Project | **Required**, indexed                                                            |
| `type`        | String             | **Required**. enum: `estimate` · `kickoff` · `invoice` · `calendar`              |
| `number`      | String             | The document number at generation time                                           |
| `snapshot`    | Mixed              | `{ total, itemCount }` — the totals as they stood, for audit and reproducibility |
| `generatedBy` | ObjectId → User    | **Required**. Rewritten by user reassignment on hard delete                      |

---

### Proposal

`src/features/proposals/proposal.model.ts` — collection `proposals`

Written only on a **`word`-mode** proposal download.

| Field                | Type               | Default    | Notes                                                         |
| -------------------- | ------------------ | ---------- | ------------------------------------------------------------- |
| `projectId`          | ObjectId → Project | —          | **Required**, indexed                                         |
| `no`                 | String             | `""`       | e.g. `ONF/EST/2026-27/0007-P4b81c3`                           |
| `lineItemIds`        | [ObjectId]         | `[]`       | Currently always a single id                                  |
| `gstMode`            | String             | `"intra"`  | enum: `intra` · `inter`                                       |
| `override.qty`       | Number             | `1`        |                                                               |
| `override.rate`      | Number             | `0`        |                                                               |
| `override.discType`  | String             | `"amount"` |                                                               |
| `override.discValue` | Number             | `0`        |                                                               |
| `partner.*`          | Strings            | —          | `name`, `type`, `email`, `mobile`, `contact`, `gstin`, `addr` |
| `ownerId`            | ObjectId → User    | —          | **Required**, indexed                                         |

---

### EstimateSequence

`src/features/projects/estimate-sequence.model.ts` — collection `estimatesequences`

| Field | Type   | Default | Notes                                                      |
| ----- | ------ | ------- | ---------------------------------------------------------- |
| `key` | String | —       | **Required**, **unique**. Financial year, e.g. `"2026-27"` |
| `seq` | Number | `0`     | Monotonic counter                                          |

One counter per Indian financial year. Replaces the legacy tool's per-browser
`localStorage` counter with a shared, atomic, server-side sequence, so two people
cannot mint the same number.

---

### Entity relationships

```
User ──owns──> Project ──has many──> LineItem
 │               │
 │               └──snapshots──> Partner ──has many──> Contact
 │                                 ▲
 ├──owns──> Partner ───────────────┘
 ├──owns──> Proposal ──references──> Project + LineItem
 ├──owns──> Contact
 └──generates──> GeneratedDocument ──references──> Project

Offering ──copied onto (not referenced by)──> LineItem
Settings ──seeds──> Project.entity + terms/sac/validity
EstimateSequence ──mints──> Project.estNo
AuditLog ──denormalised reference──> everything
```

Note the two deliberate **copies rather than references**:

- A **line item copies** the offering's scope text. Retiring an offering never
  changes what was already quoted.
- A **project snapshots** the partner and the company entity. Editing a partner
  never rewrites an issued document.

---

## 11. Domain logic reference

### 11.1 Money and GST — `src/lib/money.ts`

Ported 1:1 from the original single-file tool so generated documents produce
identical numbers. `GST_RATE = 18`.

| Function         | Behaviour                                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| `num(v)`         | Strips everything but digits, `.` and `-`, then `parseFloat`. `NaN` → `0`. Makes `"₹1,20,000"` parse as `120000`. |
| `money(n)`       | Rounds to 2 dp, formats as `en-IN` with exactly 2 decimals, prefixes `₹` — Indian grouping (`₹1,20,000.00`).      |
| `calcLine(item)` | Per-line arithmetic.                                                                                              |
| `totals(input)`  | Document arithmetic.                                                                                              |
| `toWords(n)`     | Indian-English amount in words.                                                                                   |

**`calcLine`**

```
gross = amountOverride set ? num(amountOverride) : qty × rate
disc  = discType === "percent" ? gross × discValue / 100 : discValue
disc  = clamp(disc, 0, gross)          // never negative, never exceeds gross
net   = gross − disc
```

An `amountOverride` of `""`, `null` or `undefined` means "not set".

**`totals`**

```
gross    = Σ line.gross
lineDisc = Σ line.disc
sub      = gross − lineDisc
docDisc  = docDiscType === "percent" ? sub × docDiscValue / 100 : docDiscValue
docDisc  = clamp(docDisc, 0, sub)
taxable  = sub − docDisc

gstMode === "inter"  ->  igst = taxable × 18 / 100 ;  cgst = sgst = 0
gstMode === "intra"  ->  cgst = sgst = taxable × 18 / 200 ;  igst = 0

total = taxable + cgst + sgst + igst
```

`intra` = within the same state (CGST 9% + SGST 9%); `inter` = across states
(IGST 18%).

**`toWords`** produces e.g. `"Rupees One Lakh Twenty Thousand and Fifty Paise Only"`
— crore / lakh / thousand grouping, with paise from the rounded remainder.
Zero returns `"Rupees Zero Only"`.

> Money is held as plain JavaScript numbers (IEEE-754 doubles), not integer paise or
> `Decimal128`. This is inherited from the legacy tool and is what keeps the
> documents numerically identical to it.

### 11.2 Estimate numbering — `estimate-sequence.service.ts`

```
ONF/EST/<financial-year>/<4-digit zero-padded sequence>
e.g. ONF/EST/2026-27/0001
```

`nextEstimateNo(dateStr)` resolves the Indian financial year with `fyOf()`
(April–March; a date in Jan–Mar belongs to the year that started the previous
April), then performs a single atomic `findOneAndUpdate` with `$inc: { seq: 1 }`,
`upsert: true`, `new: true`. Atomicity is what prevents two concurrent project
creations from minting the same number.

Numbers are minted at **project creation** and are immutable thereafter —
`updateProject` strips `estNo` from every patch. Derived numbers reuse the same base:

| Document        | Number                                                                     |
| --------------- | -------------------------------------------------------------------------- |
| Estimate        | `ONF/EST/2026-27/0007`                                                     |
| Kick-off        | `ONF/KO/2026-27/0007` (`/EST/` → `/KO/`)                                   |
| Invoice request | `ONF/INV-REQ/2026-27/0007` (`/EST/` → `/INV-REQ/`)                         |
| Proposal        | `ONF/EST/2026-27/0007-P4b81c3` (suffix = last 6 chars of the line-item id) |

### 11.3 Document generation — `documents.service.ts`

**Pipeline**

```
generateDocument(user, projectId, type, opts)
  ├─ canGenerate(role, type)            403 if not permitted
  ├─ buildDocData(projectId, opts)      project + items -> DocData
  │    ├─ toDocItem() per line item     applies proposal override, runs calcLine
  │    ├─ computeTotals()               lib/money totals()
  │    └─ merges entity snapshot, partner snapshot, proposal partner override
  ├─ render(type, data)                 buildEstimate | buildKickoff
  │                                     | buildInvoice | buildCalendar
  └─ if word: persist GeneratedDocument + writeAudit
```

**`DocData`** is the single flat view-model every template consumes: project header,
partner block, entity block, terms, `items: DocItem[]`, `totals`, plus the render
flags `forWord`, `isProposal`, `calView`, `calMonth`. `DocItem` carries the raw
line-item fields plus the computed `net`, `gross` and `disc`.

**Templates** — `src/features/documents/templates/`

| File           | Lines | Produces                                                                                                                                                                                           |
| -------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared.ts`    | 551   | `DocData`/`DocItem` types, escaping, date formatting, the inline style table, `docShell`, and the shared blocks: `letterhead`, `partyBlock`, `scopeTable`, `specLine`, `totalsBlock`, `signatures` |
| `estimate.ts`  | 58    | 8-column commercial summary, totals, amount in words, scope, terms, signatures                                                                                                                     |
| `kickoff.ts`   | 117   | Deliverables, kick-off inputs, scheduling table, reminder rows, notes, sign-offs. Exports `reminderRows()`, reused by the `.ics` builder                                                           |
| `invoice.ts`   | 61    | 9-column billing lines with SAC, remit-to totals, scope reference                                                                                                                                  |
| `calendar.ts`  | 374   | Kanban board **or** month grid, selected by `calView`                                                                                                                                              |
| `ics.ts`       | 65    | RFC 5545 calendar file                                                                                                                                                                             |
| `_reexport.ts` | 1     | `export * from "./shared"` — one import line per template                                                                                                                                          |

**Why inline styles.** Word ignores most class-based CSS, so every rule is emitted
inline as well. The `S` object holds the palette — navy `#203760`, orange `#F47C22`,
muted `#63718A`, borders `#A9B4C4` — exactly the original tool's.

**`docShell(title, body, forWord)`** wraps the body either as an MSO landscape
`WordSection1` (`@page` 29.7cm × 21.0cm, 1.1cm margins) or as an on-screen A4
landscape preview on a page-like white sheet with a print stylesheet. The preview
shell also injects the Propose relay script.

**Escaping** — `esc()` escapes `&`, `<`, `>`, `"`; `nl2br()` escapes then converts
newlines; `or(s, "—")` falls back to an em-dash; `na(s)` falls back to
`"Not Applicable"`.

**Section rules** (`src/lib/defaults.ts`):

- Daily Pulse and EMA carry a **topic**; a blank topic prints `"To Be Decided"`.
- Media Services carries a **project description** instead and no topic at all.
- `secShort()` abbreviates `"Exclusive Members Access (EMA)"` to `"EMA"` in tables.

### 11.4 ICS reminders — `templates/ics.ts`

`reminderRows(f)` (from `kickoff.ts`) collects every end date across the project:

| Source                 | Label          |
| ---------------------- | -------------- |
| Each item's `cardEnd`  | `Card end`     |
| Each item's `videoEnd` | `Video end`    |
| Each item's `brandEnd` | `Branding end` |
| Project `koContract`   | `Contract end` |
| Project `koEnd`        | `Project end`  |

Rows are sorted by date. For each, one all-day `VEVENT`:

- `DTSTART` = date − 2 days, `DTEND` = date + 1 day (all-day events are
  end-exclusive, so the span covers the two days before through the date itself).
- Three `VALARM` blocks, `ACTION:DISPLAY`, triggering at 09:00 UTC on D−2, D−1 and D.
- `UID` = `onf-<slugified estNo>-<index>@onference.tv`.
- `ORGANIZER` and `ATTENDEE` = the entity `coEmail`, else `admin@onference.in`.

Lines are folded at 75 octets; `,` `;` `\` are backslash-escaped and newlines
become `\n`.

> Actually **sending** reminder emails would need a scheduled server job. The `.ics`
> export covers the calendar side, exactly as the original tool noted.

### 11.5 Contact directory — `contacts/contact.service.ts`

`recordContact(partnerId, partner, ownerId, intent)` runs after every partner write
so the history maintains itself.

The `intent` is what makes this correct rather than a guess. A changed contact name
means one of two quite different things — the same person's title was fixed, or a
new person took the seat — and only the person saving knows which, so the UI asks
and passes the answer through.

| Intent                          | Target row                                                                                                                                     |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `{ mode: "update", contactId }` | That row; else the name match; else whoever currently holds the seat                                                                           |
| `{ mode: "new" }`               | The name match only — a deliberate handover must still not duplicate a name already filed, or saving twice would leave two rows for one person |
| _(none)_                        | Name match. Safe for scripts and the backfill, which are re-filing what is already stored                                                      |

After writing, every **other** `current: true` row for that partner is demoted to
`current: false` — whoever held the seat before becomes history, not deleted.

**Name matching** — `contact.match.ts`, a pure module with no database import so the
browser can use it without pulling Mongoose into the bundle:

| Helper            | Behaviour                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `normName(v)`     | Trim, lowercase, collapse whitespace                                                                                      |
| `personPart(v)`   | The person without their job title: `"B. Shetty, GM Marketing"` → `"b. shetty"`                                           |
| `sameHuman(a, b)` | True on exact match, on same person-part (a promotion), or on a Levenshtein distance within `max(1, min(len)/8)` (a typo) |

`sameHuman` only ever **suggests** an answer — whoever is saving sees the choice
spelled out and can flip it.

Both `recordContact` and `forgetPartnerContacts` **swallow their errors** and log to
console. They run after the partner has already been saved, so throwing would report
an error for work that succeeded.

### 11.6 Audit — `audit/audit.service.ts` + `audit.labels.ts`

**`writeAudit` never throws.** Every call runs _after_ its mutation has committed,
so throwing would return an error for work that already happened — the user retries
and mutates twice. Losing a log line is the lesser harm; a duplicated project or a
skipped estimate number is not. Failures go to `console.error`.

**`diffOf(before, after)`** logs only the keys the caller actually sent, and only
where the value moved. `after` is the _patch_, not the whole document — logging
every field of every update would bury the one line that mattered.

- Skips `_id`, `__v`, `createdAt`, `updatedAt`, `ownerId`.
- `norm()` normalises for comparison: Mongo hands back a `Date` where the browser
  sent `"2026-09-01"`, so without this every save of an untouched form would log a
  date change on every date field it round-tripped.
- `short()` truncates any value over 160 characters.

**`describeChange(diff)`** renders one scannable sentence:
one field → `Release date: "2026-09-14" → "2026-09-21"`;
several → `4 fields changed — Rate, Quantity, Status…`.

**`fieldLabel(key)`** maps ~50 schema keys to human labels (`projName` →
`Project name`, `koProducer` → `Production owner`, `cGstin` → `Partner GSTIN`).

**`entrySummary(action, label, meta)`** is what the "What happened" column shows. It
prefers the stored `label`, and otherwise rebuilds a sentence from `ACTION_TEXT`
plus whatever context `meta` carries — entries written before the `label` field
existed must never render as blank.

`audit.labels.ts` holds no database import so the audit table can render diffs in
the browser without dragging Mongoose into the client bundle.

### 11.7 Dashboard periods — `src/lib/period.ts`

| Key      | Window                                | Label           |
| -------- | ------------------------------------- | --------------- |
| `all`    | unbounded                             | All time        |
| `today`  | today → today                         | Today           |
| `7d`     | today−6 → today                       | Last 7 days     |
| `30d`    | today−29 → today                      | Last 30 days    |
| `month`  | 1st of this month → today             | This month      |
| `fy`     | 1 Apr → 31 Mar                        | `FY 2026-27`    |
| `custom` | `from` → `to` (either may be omitted) | Formatted range |

`resolvePeriod()` falls back to `all` for an unknown key, and for `custom` with
neither end. `dateRangeFilter()` turns a `Period` into a Mongo `{ $gte, $lte }`
fragment for the `yyyy-mm-dd` **string** field `date` — string comparison is
correct for ISO dates.

### 11.8 Performance patterns

The services share a few deliberate habits worth preserving:

| Pattern                                         | Where                                                                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Grouped aggregation instead of a query per row  | `listProjects` item counts, `ownershipByUser`, dashboard status/section counts                                            |
| Projection down to the fields actually rendered | `listProjects`, `getCalendar`, `getDashboard` — the scope text on a line item is far larger than everything else combined |
| Conditional projection by role                  | `getDashboard` does not even fetch commercial fields for ops                                                              |
| Parallel server fetches                         | `ProjectEditorPage` resolves six dependencies with `Promise.all`                                                          |
| One bulk request instead of N                   | `/api/line-items/bulk`; the editor's `saveAll` fires its patches in parallel                                              |
| Server-side rendering of page data              | Dashboard and audit log ship no client JS of their own                                                                    |

---

## 12. UI route map

Every screen exists once. The per-role `page.tsx` files are two-line mounts of a
shared component in `src/components/pages/`.

| Route                   | admin  | sales  |  ops   | Mounts                                      | Data source                         |
| ----------------------- | :----: | :----: | :----: | ------------------------------------------- | ----------------------------------- |
| `/`                     |   —    |   —    |   —    | Redirect to `/login` or `/<role>/dashboard` | `getUser()`                         |
| `/login`                | public | public | public | `LoginForm`                                 | `signIn("credentials")`             |
| `/<role>/dashboard`     |   ✓    |   ✓    |   ✓    | `DashboardPage`                             | `getDashboard()`                    |
| `/<role>/projects`      |   ✓    |   ✓    |   ✓    | `ProjectsPage` → `ProjectsListView`         | `listProjects()`                    |
| `/<role>/projects/[id]` |   ✓    |   ✓    |   ✓    | `ProjectEditorPage` → `ProjectEditor`       | 6 services in parallel              |
| `/<role>/calendar`      |   ✓    |   ✓    |   ✓    | `CalendarPage` → `CalendarView`             | `getCalendar()`                     |
| `/<role>/catalog`       |   ✓    |   ✓    |   ✓    | `CatalogPage` → `CatalogView`               | `listOfferings()`                   |
| `/<role>/partners`      |   ✓    |   ✓    |   —    | `PartnersPage` → `PartnersView`             | `listPartners()` + `listContacts()` |
| `/<role>/profile`       |   ✓    |   ✓    |   ✓    | `ProfilePage` → `ProfileView`               | `getMyProfile()`                    |
| `/admin/users`          |   ✓    |   —    |   —    | `UsersPage` → `UsersView`                   | `listUsers()` + `ownershipByUser()` |
| `/admin/settings`       |   ✓    |   —    |   —    | `SettingsPage` → `SettingsView`             | `getSettings()`                     |
| `/admin/audit`          |   ✓    |   —    |   —    | `AuditPage` → `AuditLogView`                | `listAudit()` + `listAuditActors()` |

Every route except `/` and `/login` sits behind middleware **and** a
`requireRole(area)` call in the area layout.

`loading.tsx` files sit beside most pages, rendering a matching skeleton
(`DashboardSkeleton`, `ListPageSkeleton`, `EditorSkeleton`, `KanbanSkeleton`,
`FormSkeleton`, `TableSkeleton`) during the server fetch.

### Navigation model — `src/components/shell/nav.ts`

`navFor(role)` builds one nav model for all three roles — sections are **filtered,
never forked**:

| Group                 | Items                      | Shown to     |
| --------------------- | -------------------------- | ------------ |
| Overview              | Dashboard                  | all          |
| Work                  | Projects, Content calendar | all          |
| Records               | Partners                   | admin, sales |
| Configure / Reference | Offerings catalog          | all          |
|                       | Users, Settings, Audit log | admin only   |

The group is titled _Configure_ for admin and _Reference_ for everyone else.

- `activeHref(pathname, groups)` — longest-prefix match, so
  `/admin/projects/123` highlights **Projects**.
- `labelFor(pathname, groups)` — the top-bar breadcrumb label.

### URL parameters the UI reads

| Parameter                                             | Where          | Purpose                                                                                    |
| ----------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------ |
| `?period=`, `?from=`, `?to=`                          | Dashboard      | Date window; keeps a filtered view shareable                                               |
| `?resource=`, `?actor=`, `?action=`, `?from=`, `?to=` | Audit log      | Coarse filters live in the URL so a filtered view is shareable and re-queries the database |
| `?focus=<id>`                                         | Partners list  | Page to and highlight a row (from search)                                                  |
| `?tab=content&focus=<id>`                             | Project editor | Open the Content tab on a specific item                                                    |

### Theme and chrome

Two cookies, both one year, `samesite=lax`:

| Cookie        | Values                                 | Effect                              |
| ------------- | -------------------------------------- | ----------------------------------- |
| `onf-theme`   | `light` · `dark` · _(absent = system)_ | Stamped as `data-theme` on `<html>` |
| `onf-sidebar` | `collapsed` · _(absent)_               | Sidebar width                       |

They are read **server-side** (`lib/theme.server.ts` → `getChrome()`) so the first
HTML already carries the right theme; reading them in the browser instead would
flash the wrong theme on every navigation. `themeAttr()` returns `undefined` for
`system`, stamping nothing so `prefers-color-scheme` decides.

---

## 13. Shared components

### Shell — `src/components/shell/`

| Component        | Role                                                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `AppShell`       | Layout frame: sidebar + topbar + content. Receives role, name, theme and initial collapse state from the server layout |
| `Sidebar`        | Renders `navFor(role)`, persists collapse to the `onf-sidebar` cookie                                                  |
| `Topbar`         | Breadcrumb, theme toggle, search trigger, user menu, sign-out                                                          |
| `CommandPalette` | Ctrl/Cmd-K search against `/api/search`                                                                                |
| `nav.ts`         | The nav model and active-route helpers (not a component)                                                               |

### Views — `src/components/views/`

Client components receiving serialized server data as props.

| View               | Notes                                                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ProjectEditor`    | The largest surface: project form, content ledger, scheduling table, partner panel, document previews. Tracks per-item dirty state and saves everything in parallel |
| `ProjectsListView` | Sortable, filterable project table                                                                                                                                  |
| `CalendarView`     | Kanban board and month grid over the whole content pipeline                                                                                                         |
| `PartnersView`     | Partner table plus the contact directory                                                                                                                            |
| `CatalogView`      | Offering master data; read-only unless `editable`                                                                                                                   |
| `UsersView`        | Accounts, roles, active/deleted tabs, restore                                                                                                                       |
| `SettingsView`     | Company and default-values form                                                                                                                                     |
| `AuditLogView`     | Renders diffs client-side using `audit.labels.ts`                                                                                                                   |
| `ProfileView`      | Own name and password; calls `useSession().update()` after a rename                                                                                                 |

### Project sub-components — `src/components/project/`

`Ledger` (commercial rows), `SchedulingTable` (production dates), `ItemCard`,
`DocPreview` (iframe + download + print), `ProposeModal`, `PartnerPicker`,
`ContactPicker`, `OwnerPicker`, `ActivityFeed` (per-project audit),
`NewProjectButton`, `DeleteProjectButton`, and `types.ts` for the shared row types.

### UI primitives — `src/components/ui/`

| Module           | Exports                                                                                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `primitives.tsx` | `Button`, `Badge`, `Card`, `Field`, `Banner`, `EmptyState`, `PageHead`, `statusTone`, `stageTone`                                                                             |
| `Overlay.tsx`    | `Modal`, `Drawer`, `Tabs`                                                                                                                                                     |
| `DataTable.tsx`  | `DataTable` — sortable, paginated table with a `Column<T>` API                                                                                                                |
| `Toast.tsx`      | `ToastProvider`, `useToast`                                                                                                                                                   |
| `Confirm.tsx`    | `ConfirmProvider`, `useConfirm` — promise-based confirmation dialogs                                                                                                          |
| `Skeleton.tsx`   | `Skeleton`, `SkeletonText`, `PageHeadSkeleton`, `StatsSkeleton`, `TableSkeleton`, `ListPageSkeleton`, `DashboardSkeleton`, `EditorSkeleton`, `KanbanSkeleton`, `FormSkeleton` |
| `Icon.tsx`       | `Icon` — inline SVG set, `IconName` union                                                                                                                                     |

Both providers are mounted globally in `src/app/providers.tsx`:
`SessionProvider > ToastProvider > ConfirmProvider`.

### Client fetch wrapper — `src/lib/client.ts`

```ts
export async function api<T = unknown>(
  url: string,
  opts: RequestInit = {},
): Promise<T>;
```

Sets `Content-Type: application/json`, and on a non-OK response reads `{ error }`
from the body and throws it as an `Error` — which is why every view can surface the
server's own message directly. Binary responses (`.doc`, `.ics`) bypass it and use
`fetch` directly, since they need `res.blob()` and the `Content-Disposition` header.

---

## 14. Packages

### Runtime dependencies (6)

| Package       | Declared        | Installed     | Why                                                                                                                                         |
| ------------- | --------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **next**      | `^15.1.6`       | 15.5.24       | App Router framework: routing, RSC, route handlers, middleware, `next/font`, `next/image`                                                   |
| **react**     | `^19.0.0`       | 19.2.8        | UI runtime                                                                                                                                  |
| **react-dom** | `^19.0.0`       | 19.2.8        | DOM renderer                                                                                                                                |
| **next-auth** | `5.0.0-beta.25` | 5.0.0-beta.25 | Auth.js v5 — Credentials provider, JWT sessions, middleware helper. **Pinned exactly**, as v5 is still beta and its API moves between betas |
| **mongoose**  | `^8.9.5`        | 8.24.4        | ODM: schemas, validation, indexes, connection pooling, aggregation                                                                          |
| **bcryptjs**  | `^2.4.3`        | 2.4.3         | Password hashing at cost 10. The pure-JS implementation, so there is no native build step on any platform                                   |

### Development dependencies (6)

| Package              | Declared   | Installed | Why                                                                  |
| -------------------- | ---------- | --------- | -------------------------------------------------------------------- |
| **typescript**       | `^5.7.3`   | 5.9.3     | Strict-mode type checking                                            |
| **tsx**              | `^4.19.2`  | 4.23.12   | Runs the TypeScript seed/maintenance scripts directly, no build step |
| **@types/node**      | `^22.10.7` | 22.20.1   | Node type definitions                                                |
| **@types/react**     | `^19.0.7`  | 19.2.18   | React type definitions                                               |
| **@types/react-dom** | `^19.0.3`  | 19.2.5    | React DOM type definitions                                           |
| **@types/bcryptjs**  | `^2.4.6`   | 2.4.6     | bcryptjs type definitions                                            |

### Notable transitive dependencies

107 transitive packages are locked, most of them platform-specific optional
binaries. The ones that matter:

| Package                                                             | Version         | Pulled in by | Role                                                                          |
| ------------------------------------------------------------------- | --------------- | ------------ | ----------------------------------------------------------------------------- |
| `@auth/core`                                                        | 0.37.2          | next-auth    | The actual Auth.js engine                                                     |
| `jose`                                                              | 5.10.0          | @auth/core   | JWT signing and encryption                                                    |
| `@panva/hkdf`                                                       | 1.2.1           | @auth/core   | Key derivation from `AUTH_SECRET`                                             |
| `oauth4webapi`                                                      | 3.8.7           | @auth/core   | OAuth plumbing (unused — credentials only)                                    |
| `cookie`                                                            | 0.7.1           | @auth/core   | Session cookie handling                                                       |
| `preact`, `preact-render-to-string`                                 | 10.11.3 / 5.2.3 | @auth/core   | Renders Auth.js's built-in pages (unused — `pages.signIn` points at `/login`) |
| `mongodb`                                                           | 6.20.0          | mongoose     | The official Node driver                                                      |
| `bson`                                                              | 6.10.4          | mongodb      | ObjectId and BSON serialization                                               |
| `@mongodb-js/saslprep`                                              | 1.5.0           | mongodb      | SCRAM password normalization                                                  |
| `mongodb-connection-string-url`, `whatwg-url`, `tr46`               | —               | mongodb      | Connection-string parsing                                                     |
| `kareem`, `mpath`, `mquery`, `sift`                                 | —               | mongoose     | Middleware hooks, path access, query building, in-memory filtering            |
| `@next/swc-*`                                                       | 15.5.24         | next         | Platform-specific Rust compiler binaries (optional, one is installed)         |
| `sharp` + `@img/*`                                                  | 0.35.4          | next         | Image optimisation for `next/image` (optional)                                |
| `caniuse-lite`, `postcss`, `styled-jsx`, `client-only`, `scheduler` | —               | next / react | Build and runtime internals                                                   |
| `esbuild` + `@esbuild/*`                                            | 0.28.2          | tsx (dev)    | Transpiles the scripts                                                        |

Run `npm ls --depth=0` for the current direct tree, or
`npm ls <package>` to trace a transitive one.

### Notably absent

No test runner, no Zod or other schema validator, no date library (all date work is
hand-rolled in `lib/defaults.ts` and `templates/shared.ts` against `yyyy-mm-dd`
strings), no CSS framework, no state manager, no logger, and no email or job-queue
package — hence the `.ics` export rather than sent reminders.

### Server-external packages

```ts
// next.config.ts
serverExternalPackages: ["mongoose", "bcryptjs"];
```

Both are kept out of the bundler and loaded as real Node modules at runtime.
Mongoose uses dynamic requires that Webpack cannot statically analyse, and bundling
either one breaks it. This is also why `auth.config.ts` (edge-safe, imported by
middleware) is kept strictly free of Mongoose.

---

## 15. Configuration files

### `package.json`

Name `onference-tv`, version `1.0.0`, `private: true`. Scripts and dependencies
as listed above.

### `tsconfig.json`

| Option                        | Value                           | Effect                         |
| ----------------------------- | ------------------------------- | ------------------------------ |
| `target`                      | `ES2022`                        |                                |
| `lib`                         | `dom`, `dom.iterable`, `esnext` |                                |
| `strict`                      | `true`                          | Full strict mode               |
| `noEmit`                      | `true`                          | Next handles emit              |
| `module` / `moduleResolution` | `esnext` / `bundler`            |                                |
| `jsx`                         | `preserve`                      | Next transforms JSX            |
| `isolatedModules`             | `true`                          | Required by SWC                |
| `incremental`                 | `true`                          | Writes `tsconfig.tsbuildinfo`  |
| `paths`                       | `{ "@/*": ["./src/*"] }`        | The `@/` alias used throughout |
| `skipLibCheck`                | `true`                          |                                |

Includes `next-env.d.ts`, all `.ts`/`.tsx`, and `.next/types`; excludes
`node_modules`.

### `next.config.ts`

```ts
const nextConfig: NextConfig = {
  serverExternalPackages: ["mongoose", "bcryptjs"],
};
```

### `.gitignore`

```
node_modules
.next
.env.local
.env
*.log
.DS_Store
skills
```

### `src/app/globals.css`

~3,800 lines: CSS custom properties for both themes (`:root` and the dark override),
layout primitives, the component styles backing every `ui/` primitive, the
dashboard stat and revenue tiles, tables with their sub-640px stacked-card fallback,
the Kanban board, modals, toasts and skeletons.

---

## 16. Deployment & operations

### Build and run

```bash
npm ci
npm run build
npm start          # defaults to port 3000
```

Any Node host works — Vercel, a container, or a VM behind a reverse proxy. The only
hard requirements are Node 18+, reachable MongoDB, and both environment variables.

### First deployment checklist

1. Set `MONGODB_URI` and `AUTH_SECRET` in the host's environment.
2. `npm run seed` — creates the three default accounts, the catalog and settings.
3. `npm run indexes` — **required in production**, where Mongoose `autoIndex` is off.
   Run it again after any schema index change.
4. Sign in as `admin` and immediately change all three seeded passwords via
   **Users**.
5. Fill in **Settings** — GSTIN, PAN, TAN, MSME, bank details, default terms — since
   these seed every new project's letterhead snapshot.
6. Optionally `npx tsx src/scripts/backfill-contacts.ts` if partners already exist.

### Operational notes

- **Sessions are stateless JWTs.** Rotating `AUTH_SECRET` invalidates every session
  at once. There is no server-side session store to revoke individually;
  deactivating a user blocks the _next_ sign-in but does not immediately kill a live
  token.
- **Deactivate rather than delete.** `DELETE /api/users/[id]` without `?hard=1` is
  reversible and keeps every ownership link resolvable.
- **Backups.** The audit log is the only record of deleted projects and their line
  items — `project.delete` cascades the items without individual entries. Back up
  `auditlogs` with everything else.
- **Index maintenance.** `npm run indexes` reports every index per model and
  pre-flights duplicate emails before failing.
- **The `.ics` gap.** Sending reminder emails needs a scheduled job; nothing in this
  codebase sends mail.

### Health checks

There is no dedicated health endpoint. `GET /api/settings` with a valid session is
the cheapest round trip that proves the app, the session layer and MongoDB are all
alive.

---

## 17. Behaviours worth knowing

Documented as-is — these are current behaviours, some intentional, some worth a look.

### Access control

| #   | Observation                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **`GET /api/projects/[id]` does not redact line items.** `getProject` returns items straight from Mongo without `redactLineItemFor`, so an ops user calling this endpoint directly receives `rate`, `qty` and the discount fields. The project editor page is unaffected — it calls `listLineItems`, which does redact. Every other read path (`/api/line-items`, `/api/calendar`, the dashboard) redacts correctly. |
| 2   | **`GET /api/settings` has no role check.** Any signed-in user, ops included, can read the company GSTIN, PAN, TAN and bank details. The write path is admin-only.                                                                                                                                                                                                                                                    |
| 3   | **`GET /api/documents/ics` has no role check.** `generateICS` never calls `canGenerate`, so any signed-in user can download reminders for any project. The file carries dates and names only — no pricing.                                                                                                                                                                                                           |
| 4   | **Line-item reads are not ownership-scoped.** `listLineItems` checks `lineItem.read` but never filters by project owner, so sales can read the line items of another rep's project. This matches `project.read` being `all` for sales, so it is consistent with the matrix rather than a gap in enforcing it.                                                                                                        |
| 5   | **`deletePartner` does not check ownership.** Only admin holds `partner.delete`, so the scope never comes into play today — but a future grant of `delete: "own"` to sales would not be enforced without adding the check.                                                                                                                                                                                           |

### Data and consistency

| #   | Observation                                                                                                                                                                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6   | **Deleting a partner leaves projects pointing at it.** `partnerId` on a project is not cleared, and the denormalised `cName`/`cEmail`/`cGstin` snapshot stays — which is the point: issued documents must not change. The stale `partnerId` simply no longer resolves. |
| 7   | **Hard-deleting a project is irreversible and cascades.** Line items are removed with `deleteMany`, bypassing `deleteLineItem`, so only the single `project.delete` audit entry (carrying `itemCount`) records that they existed.                                      |
| 8   | **`archived` is never set by any code path.** Every list filters `archived: false`, and the field defaults to `false`, so the soft-delete plumbing exists on Project and Partner but has no UI or API to trigger it. Projects are hard-deleted instead.                |
| 9   | **`koOwner` and `koProducer` are name strings, not user references.** Renaming a user does not update projects that named them, and a deleted user's name persists on the project. This is deliberate — the document should print who was named at the time.           |
| 10  | **Audit date filters are UTC-anchored** while project and line-item dates are local `yyyy-mm-dd` strings. For India (UTC+5:30) an audit `from`/`to` boundary sits 5½ hours off local midnight.                                                                         |
| 11  | **`upcoming` is capped at 30 rows** on the dashboard, but `overdueCount` is computed from the full list before the cap — so the count can legitimately exceed the visible rows.                                                                                        |

### API shape

| #   | Observation                                                                                                                                                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 12  | **`mode` defaults differ between the two document endpoints.** `/api/documents/generate` defaults to `word`; `/api/documents/proposal` defaults to `preview`. Both were kept as the legacy flows had them.                                                                        |
| 13  | **PATCH endpoints return `null`, not 404, for a missing id.** `updateProject`, `updateLineItem` and `updatePartner` all return `null` with a 200. Only `GET /api/projects/[id]` returns a real 404.                                                                               |
| 14  | **There is no request-body validation layer.** Services name the fields they accept, and Mongoose silently discards unknown keys. Type coercion failures surface as 400s from Mongoose rather than as field-level messages.                                                       |
| 15  | **No list endpoint paginates.** `/api/projects`, `/api/partners`, `/api/catalog`, `/api/users`, `/api/contacts` and `/api/calendar` all return complete result sets; only the audit log takes a `limit` (capped at 2000). Paging and filtering happen client-side in `DataTable`. |
| 16  | **`POST /api/users` enforces no password minimum.** The 8-character rule applies only to self-service changes via `PATCH /api/profile`.                                                                                                                                           |

### Correctness of the money path

| #   | Observation                                                                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 17  | **Amounts are IEEE-754 doubles**, not integer paise or `Decimal128`. Inherited from the legacy tool, and the reason generated documents reproduce its numbers exactly. Rounding happens only at display time, in `money()` and `toWords()`. |
| 18  | **A proposal override discards `amountOverride`.** `toDocItem` sets `amountOverride: ""` whenever an override is supplied, so the override's `qty × rate` wins outright — matching the legacy proposal flow.                                |

---

## Appendix A — Reference values

### Sections

| Constant  | Value                            | Carries                |
| --------- | -------------------------------- | ---------------------- |
| `SEC_DP`  | `Daily Pulse`                    | Topic                  |
| `SEC_EMA` | `Exclusive Members Access (EMA)` | Topic (shown as `EMA`) |
| `SEC_MS`  | `Media Services`                 | Project description    |

### Enumerations

| Enum          | Values                                                     |
| ------------- | ---------------------------------------------------------- |
| Status        | `Planner` · `In Progress` · `Done` · `Cancelled`           |
| Partner type  | `Receivable` · `Payable` · `Barter`                        |
| GST mode      | `intra` (CGST+SGST) · `inter` (IGST)                       |
| Discount type | `amount` · `percent`                                       |
| Role          | `admin` · `sales` · `ops`                                  |
| Document type | `estimate` · `kickoff` · `invoice` · `calendar`            |
| Period key    | `all` · `today` · `7d` · `30d` · `month` · `fy` · `custom` |

### Constants

| Constant                   | Value                 | Defined in                          |
| -------------------------- | --------------------- | ----------------------------------- |
| `GST_RATE`                 | `18`                  | `lib/money.ts`                      |
| `DEFAULT_SAC`              | `998365`              | `lib/defaults.ts`                   |
| `DEFAULT_VALIDITY`         | `15` (days)           | `lib/defaults.ts`                   |
| `TBD`                      | `To Be Decided`       | `lib/defaults.ts`                   |
| bcrypt cost                | `10`                  | `user.service.ts`, `auth.ts`, seeds |
| Upcoming horizon           | 14 days               | `dashboard.service.ts`              |
| Upcoming cap               | 30 rows               | `dashboard.service.ts`              |
| Audit default / max limit  | 500 / 2000            | `audit.service.ts`                  |
| Project-audit limit        | 100 (cap 500)         | `audit.service.ts`                  |
| Search minimum / per group | 2 chars / 6 hits      | `search.service.ts`                 |
| Audit value truncation     | 160 chars             | `audit.labels.ts`                   |
| Cookie lifetime            | 31,536,000 s (1 year) | `lib/theme.ts`                      |

### Date helpers

| Helper            | Behaviour                                                           | Where                 |
| ----------------- | ------------------------------------------------------------------- | --------------------- |
| `toLocalISO(d)`   | Local (not UTC) `yyyy-mm-dd`                                        | `lib/defaults.ts`     |
| `fyOf(dateStr)`   | Indian FY label, e.g. `2026-27` (April boundary)                    | `lib/defaults.ts`     |
| `parseISO(s)`     | Local-midnight parse, so a date never slips a day across time zones | `templates/shared.ts` |
| `fmtDate(s)`      | `14 Jul 2026`; `—` when blank                                       | `templates/shared.ts` |
| `fmtShort(s)`     | `14 Jul`                                                            | `templates/shared.ts` |
| `shiftDays(s, n)` | Date arithmetic on `yyyy-mm-dd`                                     | `templates/shared.ts` |

---

## Appendix B — Adding a feature

The architecture is designed so this is additive:

1. **Model** — `src/features/<domain>/<name>.model.ts`. Copy the hot-reload guard
   from any existing model; declare indexes for the queries you will actually run.
2. **RBAC** — add the resource to the `Resource` union in `src/lib/rbac.ts` and one
   cell per role in `MATRIX`. This is the only place permissions are decided.
3. **Service** — `src/features/<domain>/<name>.service.ts`. Start with
   `await connectDB()`, then `can(user.role, …)`, then the ownership check for
   `scope === "own"`, then the write, then `writeAudit()` last.
4. **Route** — `src/app/api/<resource>/route.ts`, wrapped in `withUser`. Keep it a
   thin controller: parse, delegate, serialise.
5. **Audit labels** — add the action to `ACTION_TEXT` and any new fields to
   `FIELD_LABELS` in `src/features/audit/audit.labels.ts`, so the log reads in plain
   English.
6. **Page** — a server component in `src/components/pages/` that fetches and
   `serialize()`s, plus a client view in `src/components/views/`. Mount it from each
   role's tree with a two-line `page.tsx`, and add a `loading.tsx` skeleton.
7. **Navigation** — one entry in `navFor()` in `src/components/shell/nav.ts`,
   filtered by role.
8. **Indexes** — register the model in `src/scripts/ensure-indexes.ts` and run
   `npm run indexes`.

The rules that keep this consistent:

- Permissions are decided **once**, in `rbac.ts`. Services enforce; the UI only mirrors.
- Services never trust a patch. Name the fields you accept, or strip the ones you do not.
- `writeAudit` runs **after** the mutation commits, and never throws.
- Route handlers stay thin. Business rules belong in services, where the server page
  and the API endpoint share them.
