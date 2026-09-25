/**
 * Central permission matrix. Every service + API route checks against this.
 * Adding a role or a resource later is additive here — no rewrites elsewhere.
 */
export type Role = "admin" | "sales" | "ops";

export type Resource =
  | "project"
  | "lineItem"
  | "partner"
  | "catalog"
  | "user"
  | "settings"
  | "calendar"
  | "dashboard"
  | "auditLog";

export type Action = "create" | "read" | "update" | "delete";

/** "own" = only records the user owns; "all" = every record; false = denied. */
export type Scope = "all" | "own" | false;

type Matrix = Record<
  Role,
  Partial<Record<Resource, Partial<Record<Action, Scope>>>>
>;

export const MATRIX: Matrix = {
  admin: {
    project: { create: "all", read: "all", update: "all", delete: "all" },
    lineItem: { create: "all", read: "all", update: "all", delete: "all" },
    partner: { create: "all", read: "all", update: "all", delete: "all" },
    catalog: { create: "all", read: "all", update: "all", delete: "all" },
    user: { create: "all", read: "all", update: "all", delete: "all" },
    settings: { create: "all", read: "all", update: "all", delete: "all" },
    calendar: { read: "all" },
    dashboard: { read: "all" },
    auditLog: { read: "all" },
  },
  sales: {
    project: { create: "own", read: "all", update: "own", delete: false },
    lineItem: { create: "own", read: "all", update: "own", delete: "own" },
    partner: { create: "own", read: "all", update: "own", delete: false },
    catalog: { read: "all" },
    calendar: { read: "all" },
    dashboard: { read: "own" },
  },
  ops: {
    project: { read: "all", update: "all" },
    // create, so ops can add content itself; delete stays with sales
    lineItem: { create: "all", read: "all", update: "all" },
    catalog: { read: "all" },
    calendar: { read: "all" },
    dashboard: { read: "all" },
  },
};

export function can(role: Role, resource: Resource, action: Action): Scope {
  return MATRIX[role]?.[resource]?.[action] ?? false;
}

export const COMMERCIAL_FIELDS = [
  "rate",
  "qty",
  "discType",
  "discValue",
  "amountOverride",
] as const;

/**
 * Project-level counterpart to OPS_EDITABLE_FIELDS. Ops schedules production;
 * they must not be able to reach commercial fields (terms, document discount,
 * tax treatment) through a direct PATCH just because the UI hides them.
 */
export const OPS_EDITABLE_PROJECT_FIELDS = [
  "koStart",
  "koEnd",
  "koContract",
  "koOwner",
  "koProducer",
  "koNotes",
] as const;

/**
 * What ops may change on a content item. They run delivery, so everything that
 * describes or schedules the work is theirs to edit alongside sales.
 *
 * COMMERCIAL_FIELDS are deliberately absent and stay that way: ops never sees
 * pricing (redactLineItemFor strips it on the way out), so accepting it on the
 * way in would let a direct PATCH set a rate the sender could not read back.
 */
export const OPS_EDITABLE_FIELDS = [
  // scheduling and production
  "topic",
  "projDesc",
  "status",
  "cardName",
  "recDate",
  "relDate",
  "cardEnd",
  "videoEnd",
  "brandEnd",
  // what the item is, and how it deviates
  "name",
  "cardType",
  "promo",
  "stream",
  "produced",
  "dev",
  // "incl" and "excl" are absent on purpose: the agreed scope is what was sold,
  // so it stays with sales even though ops delivers against it
] as const;

export function redactLineItemFor<T extends Record<string, unknown>>(
  role: Role,
  item: T,
): T {
  if (role !== "ops") return item;
  const clone: Record<string, unknown> = { ...item };
  for (const f of COMMERCIAL_FIELDS) delete clone[f];
  delete clone.net;
  delete clone.gross;
  delete clone.disc;
  return clone as T;
}

export function canSeeMoney(role: Role): boolean {
  return role !== "ops";
}

export class ForbiddenError extends Error {
  status = 403;
  constructor(msg = "You do not have permission to do that.") {
    super(msg);
  }
}
