import { connectDB } from "@/lib/db";
import { Project } from "./project.model";
import { LineItem } from "@/features/line-items/line-item.model";
import { can, ForbiddenError, OPS_EDITABLE_PROJECT_FIELDS } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";
import {
  writeAudit,
  diffOf,
  describeChange,
} from "@/features/audit/audit.service";
import { getSettings } from "@/features/settings/settings.service";
import { nextEstimateNo } from "./estimate-sequence.service";
import {
  DEFAULT_SAC,
  DEFAULT_TERMS,
  DEFAULT_VALIDITY,
  toLocalISO,
} from "@/lib/defaults";

// The project service handles the business logic for managing projects, including listing, retrieving, creating, updating, and deleting projects.
// It enforces access control based on user roles and scopes, ensuring that users can only perform actions they are authorized for.
// The service also interacts with the database to fetch and manipulate project and line item data,
// while maintaining audit logs for changes made to projects.

function scopeFilter(user: CurrentUser, action: "read" | "update" | "delete") {
  const scope = can(user.role, "project", action);
  if (!scope) throw new ForbiddenError();
  const base: Record<string, unknown> = { archived: false };
  if (scope === "own") base.ownerId = user.id;
  return base;
}

export async function listProjects(user: CurrentUser) {
  await connectDB();
  const scope = can(user.role, "project", "read");
  if (!scope) throw new ForbiddenError();
  const filter: Record<string, unknown> = { archived: false };
  // sales/ops can read all; only restrict if a role were "own" for read.
  if (scope === "own") filter.ownerId = user.id;
  // projected to the list columns — terms/entity/notes are never shown here
  const projects = await Project.find(filter, {
    projName: 1,
    cName: 1,
    partnerType: 1,
    estNo: 1,
    date: 1,
    koEnd: 1,
    ownerId: 1,
    gstMode: 1,
    updatedAt: 1,
  })
    .sort({ updatedAt: -1 })
    .lean();

  // one grouped query for all counts, rather than a query per project
  const counts = await LineItem.aggregate([
    { $match: { projectId: { $in: projects.map((p) => p._id) } } },
    { $group: { _id: "$projectId", n: { $sum: 1 } } },
  ]);
  const countOf = new Map(
    counts.map((c: { _id: unknown; n: number }) => [String(c._id), c.n]),
  );

  return projects.map((p) => ({
    ...p,
    itemCount: countOf.get(String(p._id)) ?? 0,
  }));
}

export async function getProject(user: CurrentUser, id: string) {
  await connectDB();
  if (!can(user.role, "project", "read")) throw new ForbiddenError();
  const project = (await Project.findOne({
    _id: id,
    archived: false,
  }).lean()) as any;
  if (!project) return null;
  const items = await LineItem.find({ projectId: id })
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean();
  return { project, items };
}

/** Everything the legacy form had hard-coded in its markup, resolved from
 *  admin Settings so a new project opens pre-filled exactly like the old tool. */
async function prefillsFor(data: Record<string, unknown>) {
  const s = await getSettings();
  const keep = (k: string, fallback: unknown) => {
    const v = data[k];
    return v === undefined || v === null || v === "" ? fallback : v;
  };
  const date = String(keep("date", toLocalISO()));
  return {
    date,
    validity: keep("validity", s.defaultValidity || DEFAULT_VALIDITY),
    sac: keep("sac", s.defaultSac || DEFAULT_SAC),
    terms: keep("terms", s.defaultTerms || DEFAULT_TERMS),
    entity: (data.entity as Record<string, unknown>) ?? {
      coName: s.coName,
      coGstin: s.coGstin,
      coLlpin: s.coLlpin,
      coPan: s.coPan,
      coTan: s.coTan,
      coMsme: s.coMsme,
      coAddr: s.coAddr,
      coEmail: s.coEmail,
      coSite: s.coSite,
      coBank: s.coBank,
    },
  };
}

export async function createProject(
  user: CurrentUser,
  data: Record<string, unknown>,
) {
  await connectDB();
  if (!can(user.role, "project", "create")) throw new ForbiddenError();
  const pre = await prefillsFor(data);
  // always minted here — a client-supplied number could collide with an existing one
  const estNo = await nextEstimateNo(pre.date);
  const project = await Project.create({
    ...data,
    ...pre,
    estNo,
    ownerId: user.id,
  });
  await writeAudit(user, "project.create", "project", String(project._id), {
    projectId: String(project._id),
    label: `Created “${project.projName || "Untitled project"}”${project.estNo ? ` as ${project.estNo}` : ""}`,
    meta: { projName: project.projName, estNo: project.estNo },
  });
  return project.toObject();
}

function assertCanWrite(
  user: CurrentUser,
  projectOwnerId: string,
  action: "update" | "delete",
) {
  const scope = can(user.role, "project", action);
  if (!scope) throw new ForbiddenError();
  if (scope === "own" && projectOwnerId !== user.id) {
    throw new ForbiddenError("You can only modify your own projects.");
  }
}

export async function updateProject(
  user: CurrentUser,
  id: string,
  patch: Record<string, unknown>,
) {
  await connectDB();
  const existing = (await Project.findById(id).lean()) as any;
  if (!existing) return null;
  assertCanWrite(user, String(existing.ownerId), "update");

  // Ops may only move production dates and owners — strip everything else
  // server-side, exactly as updateLineItem does for commercial line fields.
  let safePatch = patch;
  if (user.role === "ops") {
    safePatch = {};
    for (const f of OPS_EDITABLE_PROJECT_FIELDS) {
      if (f in patch) safePatch[f] = patch[f];
    }
  }
  // ownerId can never be reassigned via patch, and the estimate number is
  // system-assigned at creation — allowing edits would break its uniqueness
  // and let two projects claim the same number
  delete safePatch.ownerId;
  delete safePatch.estNo;

  const updated = (await Project.findByIdAndUpdate(id, safePatch, {
    new: true,
  }).lean()) as any;
  const changed = diffOf(existing, safePatch);
  await writeAudit(user, "project.update", "project", id, {
    projectId: id,
    label: describeChange(changed),
    meta: { projName: existing.projName, changed },
  });
  return updated;
}

export async function deleteProject(user: CurrentUser, id: string) {
  await connectDB();
  const existing = (await Project.findById(id).lean()) as any;
  if (!existing) return null;
  assertCanWrite(user, String(existing.ownerId), "delete");
  // hard delete for admin (matrix "all"); sales cannot reach here (delete:false)
  // The cascade removes items without going through deleteLineItem, so this is
  // the only record that they ever existed — count them before they are gone.
  const itemCount = await LineItem.countDocuments({ projectId: id });
  await LineItem.deleteMany({ projectId: id });
  await Project.findByIdAndDelete(id);
  await writeAudit(user, "project.delete", "project", id, {
    projectId: id,
    label: `Deleted “${existing.projName || "Untitled project"}”${existing.estNo ? ` (${existing.estNo})` : ""} and ${itemCount} content item${itemCount === 1 ? "" : "s"}`,
    meta: {
      projName: existing.projName,
      estNo: existing.estNo,
      cName: existing.cName,
      partnerType: existing.partnerType,
      itemCount,
    },
  });
  return { ok: true };
}
