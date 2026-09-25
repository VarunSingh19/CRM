import { connectDB } from "@/lib/db";
import { AuditLog } from "./audit-log.model";
import { can, ForbiddenError } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";

export interface AuditOpts {
  meta?: Record<string, unknown>;
  /** Ties line-item and document entries back to their project. */
  projectId?: string;
  /** Human summary shown in the table. */
  label?: string;
}

/**
 * Audit writes never fail the caller. Every writeAudit runs *after* its
 * mutation has committed, so throwing here would return an error for work that
 * already happened — the user retries and mutates twice. Losing a log line is
 * the lesser harm; a duplicated project or a skipped estimate number is not.
 */
export async function writeAudit(
  actor: CurrentUser,
  action: string,
  resource: string,
  resourceId = "",
  opts: AuditOpts = {}
): Promise<void> {
  try {
    await connectDB();
    await AuditLog.create({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action, resource, resourceId,
      projectId: opts.projectId ?? "",
      label: opts.label ?? "",
      meta: opts.meta ?? {},
    });
  } catch (e) {
    console.error("[audit] write failed:", action, e);
  }
}

/**
 * Sign-in, sign-out and permission denials. Separate because a failed login
 * against an unknown username has no CurrentUser to attribute it to.
 */
export async function writeAuthAudit(
  action: string,
  o: {
    actorId?: string; actorName?: string; actorRole?: string;
    label?: string; meta?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await connectDB();
    await AuditLog.create({
      ...(o.actorId ? { actorId: o.actorId } : {}),
      actorName: o.actorName ?? "",
      actorRole: o.actorRole ?? "",
      action,
      resource: "auth",
      resourceId: "",
      label: o.label ?? "",
      meta: o.meta ?? {},
    });
  } catch (e) {
    console.error("[audit] auth write failed:", action, e);
  }
}

/* ------------------------------------------------------------------ diffing */

// Kept in audit.labels.ts so the audit table can render diffs client-side
// without importing this file (and mongoose with it).
export { diffOf, describeChange, fieldLabel } from "./audit.labels";

/* ------------------------------------------------------------------ reading */

export interface AuditFilter {
  actorId?: string;
  resource?: string;
  action?: string;
  projectId?: string;
  from?: string;
  to?: string;
  limit?: number;
}

function assertCanRead(user: CurrentUser) {
  if (!can(user.role, "auditLog", "read")) throw new ForbiddenError("The audit log is admin-only.");
}

export async function listAudit(user: CurrentUser, f: AuditFilter = {}) {
  assertCanRead(user);
  await connectDB();

  const q: Record<string, unknown> = {};
  if (f.actorId) q.actorId = f.actorId;
  if (f.resource) q.resource = f.resource;
  if (f.action) q.action = f.action;
  if (f.projectId) q.projectId = f.projectId;
  if (f.from || f.to) {
    const range: Record<string, Date> = {};
    if (f.from) range.$gte = new Date(`${f.from}T00:00:00.000Z`);
    if (f.to) range.$lte = new Date(`${f.to}T23:59:59.999Z`);
    q.createdAt = range;
  }

  return AuditLog.find(q)
    .sort({ createdAt: -1 })
    .limit(Math.min(f.limit ?? 500, 2000))
    .lean();
}

/**
 * Everything that touched one project: the project row itself, plus the line
 * items and documents that carry its id. Served by the projectId index.
 */
export async function listAuditForProject(user: CurrentUser, projectId: string, limit = 100) {
  assertCanRead(user);
  await connectDB();
  return AuditLog.find({
    $or: [
      { resource: "project", resourceId: projectId },
      { projectId },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 500))
    .lean();
}

/** Distinct actors, for the filter dropdown. */
export async function listAuditActors(user: CurrentUser) {
  assertCanRead(user);
  await connectDB();
  const rows = await AuditLog.aggregate([
    { $group: { _id: "$actorId", name: { $first: "$actorName" } } },
    { $sort: { name: 1 } },
  ]);
  return rows
    .filter((r: { _id: unknown }) => !!r._id)
    .map((r: { _id: unknown; name: string }) => ({ id: String(r._id), name: r.name || "Unknown" }));
}
