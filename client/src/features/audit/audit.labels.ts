/**
 * Pure helpers, no database import — the audit table renders diffs in the
 * browser, and pulling audit.service in there would drag mongoose into the
 * client bundle.
 */

const MAX_VALUE = 160;
const SKIP = new Set(["_id", "__v", "createdAt", "updatedAt", "ownerId"]);

function short(v: unknown): unknown {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" || typeof v === "boolean") return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = typeof v === "string" ? v : (JSON.stringify(v) ?? String(v));
  return s.length > MAX_VALUE ? `${s.slice(0, MAX_VALUE)}…` : s;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T|$)/;

/**
 * Comparable form. Mongo hands back a Date where the browser sent
 * "2026-09-01"; without this every save of an untouched form would log a date
 * change on every date field it round-tripped.
 */
function norm(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "" : v.toISOString();
  if (typeof v === "string") {
    if (!ISO_DATE.test(v)) return v;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? v : d.toISOString();
  }
  if (typeof v === "object") return JSON.stringify(v) ?? "";
  return String(v);
}

/**
 * Only the keys the caller actually sent, and only where the value moved.
 * `after` is the patch, not the whole document — logging every field of every
 * update would bury the one line that mattered.
 */
export function diffOf(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown>
): Record<string, [unknown, unknown]> {
  const out: Record<string, [unknown, unknown]> = {};
  for (const k of Object.keys(after ?? {})) {
    if (SKIP.has(k)) continue;
    const b = before?.[k];
    const a = after[k];
    if (norm(b) === norm(a)) continue;
    out[k] = [short(b), short(a)];
  }
  return out;
}

const FIELD_LABELS: Record<string, string> = {
  projName: "Project name", cName: "Partner", partnerType: "Partner type",
  cEmail: "Partner email", cMobile: "Partner mobile", cAddr: "Partner address",
  cGstin: "Partner GSTIN", date: "Document date", terms: "Terms",
  gstMode: "GST treatment", docDiscType: "Document discount type",
  docDiscValue: "Document discount", validity: "Validity", estNo: "Estimate no.",
  koStart: "Project start", koEnd: "Project end", koContract: "Contract",
  koOwner: "Account owner", koProducer: "Production owner", koNotes: "Notes",
  rate: "Rate", qty: "Quantity", discType: "Discount type", discValue: "Discount",
  amountOverride: "Amount override", status: "Status", topic: "Topic",
  cardName: "Card name", projDesc: "Description", section: "Section",
  recDate: "Recording date", relDate: "Release date", cardEnd: "Card end",
  videoEnd: "Video end", brandEnd: "Branding end",
  name: "Name", email: "Email", mobile: "Mobile", gstin: "GSTIN",
  addr: "Address", contact: "Contact", type: "Type", role: "Role",
  active: "Active", username: "Username", sortOrder: "Order",
  itemCount: "Content items", count: "Rows affected", total: "Document total",
  number: "Document number", passwordReset: "Password reset",
  reason: "Reason", method: "HTTP method", path: "Endpoint", message: "Message",
};

export function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key;
}

const ACTION_TEXT: Record<string, string> = {
  "project.create": "Created a project",
  "project.update": "Edited a project",
  "project.delete": "Deleted a project",
  "project.estimateNo": "Regenerated the estimate number",
  "lineItem.create": "Added a content item",
  "lineItem.update": "Edited a content item",
  "lineItem.delete": "Removed a content item",
  "lineItem.bulkUpdate": "Bulk-updated content items",
  "lineItem.bulkDelete": "Bulk-deleted content items",
  "partner.create": "Created a partner",
  "partner.update": "Edited a partner",
  "partner.delete": "Deleted a partner",
  "catalog.create": "Added an offering",
  "catalog.update": "Edited an offering",
  "catalog.delete": "Retired an offering",
  "user.create": "Created a user",
  "user.update": "Edited a user",
  "user.deactivate": "Deleted a user (restorable)",
  "user.delete": "Permanently deleted a user",
  "profile.update": "Updated their own profile",
  "settings.update": "Updated company settings",
  "document.estimate": "Generated an estimate",
  "document.kickoff": "Generated a kick-off document",
  "document.invoice": "Generated an invoice request",
  "document.calendar": "Generated a content calendar",
  "document.proposal": "Generated a proposal",
  "document.ics": "Downloaded calendar reminders",
  "auth.login": "Signed in",
  "auth.logout": "Signed out",
  "auth.login.failed": "Failed sign-in",
  "auth.denied": "Permission denied",
};

/**
 * What the "What happened" column shows. Entries written before the label
 * field existed have none, so this rebuilds a sentence from whatever context
 * the row does carry, and falls back to the action's plain-English name. A row
 * in the audit log should never read as blank.
 */
export function entrySummary(
  action: string,
  label?: string | null,
  meta?: Record<string, unknown> | null
): string {
  if (label && label.trim()) return label.trim();

  const m = (meta ?? {}) as Record<string, any>;
  const parts: string[] = [ACTION_TEXT[action] ?? action.split(".").reverse().join(" ")];

  const named = m.projName || m.name || m.topic || m.cardName || m.username;
  if (named) parts.push(`“${named}”`);
  if (m.estNo) parts.push(`(${m.estNo})`);

  if (typeof m.itemCount === "number") {
    parts.push(`— ${m.itemCount} content item${m.itemCount === 1 ? "" : "s"}`);
  } else if (typeof m.count === "number") {
    parts.push(`— ${m.count} row${m.count === 1 ? "" : "s"}`);
  }

  const changed = m.changed as Record<string, [unknown, unknown]> | undefined;
  if (changed && Object.keys(changed).length) parts.push(`— ${describeChange(changed)}`);

  return parts.join(" ");
}

function show(v: unknown): string {
  if (v === null || v === undefined) return "empty";
  if (typeof v === "boolean") return v ? "yes" : "no";
  return `“${String(v)}”`;
}

/** One scannable sentence for the table's "What happened" column. */
export function describeChange(diff: Record<string, [unknown, unknown]>): string {
  const keys = Object.keys(diff);
  if (!keys.length) return "No fields changed";
  if (keys.length === 1) {
    const k = keys[0];
    return `${fieldLabel(k)}: ${show(diff[k][0])} → ${show(diff[k][1])}`;
  }
  const named = keys.slice(0, 3).map(fieldLabel).join(", ");
  return `${keys.length} fields changed — ${named}${keys.length > 3 ? "…" : ""}`;
}
