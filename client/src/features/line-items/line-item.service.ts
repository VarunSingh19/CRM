import { connectDB } from "@/lib/db";
import { LineItem } from "./line-item.model";
import { Project } from "@/features/projects/project.model";
import {
  can, ForbiddenError, redactLineItemFor, OPS_EDITABLE_FIELDS,
} from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";
import { writeAudit, diffOf, describeChange } from "@/features/audit/audit.service";

async function projectOwner(projectId: string): Promise<string | null> {
  const p = await Project.findById(projectId).select("ownerId").lean() as any;
  return p ? String(p.ownerId) : null;
}

export async function listLineItems(user: CurrentUser, projectId: string) {
  await connectDB();
  if (!can(user.role, "lineItem", "read")) throw new ForbiddenError();
  const items = await LineItem.find({ projectId }).sort({ sortOrder: 1, createdAt: 1 }).lean();
  return items.map((i) => redactLineItemFor(user.role, i as Record<string, unknown>));
}

export async function createLineItem(user: CurrentUser, projectId: string, data: Record<string, unknown>) {
  await connectDB();
  const scope = can(user.role, "lineItem", "create");
  if (!scope) throw new ForbiddenError();
  if (scope === "own" && (await projectOwner(projectId)) !== user.id) {
    throw new ForbiddenError("You can only add items to your own projects.");
  }
  const item = await LineItem.create({ ...data, projectId });
  await writeAudit(user, "lineItem.create", "lineItem", String(item._id), {
    projectId,
    label: `Added content “${item.topic || item.cardName || "Untitled"}”`,
    meta: { topic: item.topic, cardName: item.cardName, section: item.section },
  });
  return redactLineItemFor(user.role, item.toObject() as Record<string, unknown>);
}

export async function updateLineItem(user: CurrentUser, id: string, patch: Record<string, unknown>) {
  await connectDB();
  const scope = can(user.role, "lineItem", "update");
  if (!scope) throw new ForbiddenError();

  const existing = await LineItem.findById(id).lean() as any;
  if (!existing) return null;

  if (scope === "own" && (await projectOwner(String(existing.projectId))) !== user.id) {
    throw new ForbiddenError("You can only edit items on your own projects.");
  }

  // Ops may only touch production fields — strip everything else server-side.
  let safePatch = patch;
  if (user.role === "ops") {
    safePatch = {};
    for (const f of OPS_EDITABLE_FIELDS) {
      if (f in patch) safePatch[f] = patch[f];
    }
  }
  delete safePatch.projectId;

  const updated = await LineItem.findByIdAndUpdate(id, safePatch, { new: true }).lean() as any;
  const changed = diffOf(existing, safePatch);
  const on = existing.topic || existing.cardName || "content item";
  await writeAudit(user, "lineItem.update", "lineItem", id, {
    projectId: String(existing.projectId),
    label: `${describeChange(changed)} — on “${on}”`,
    meta: { topic: existing.topic, cardName: existing.cardName, changed },
  });
  return redactLineItemFor(user.role, updated as Record<string, unknown>);
}

export async function deleteLineItem(user: CurrentUser, id: string) {
  await connectDB();
  const scope = can(user.role, "lineItem", "delete");
  if (!scope) throw new ForbiddenError();
  const existing = await LineItem.findById(id).lean() as any;
  if (!existing) return null;
  if (scope === "own" && (await projectOwner(String(existing.projectId))) !== user.id) {
    throw new ForbiddenError();
  }
  await LineItem.findByIdAndDelete(id);
  await writeAudit(user, "lineItem.delete", "lineItem", id, {
    projectId: String(existing.projectId),
    label: `Removed content “${existing.topic || existing.cardName || "Untitled"}”`,
    meta: {
      topic: existing.topic, cardName: existing.cardName,
      section: existing.section, status: existing.status, rate: existing.rate, qty: existing.qty,
    },
  });
  return { ok: true };
}

/**
 * One round trip for a multi-row status change or delete, replacing the
 * per-row request loops the editor used to fire. Ownership and field-level
 * permissions are enforced exactly as they are for a single row.
 */
export async function bulkUpdateLineItems(
  user: CurrentUser, ids: string[], patch: Record<string, unknown>
) {
  await connectDB();
  const scope = can(user.role, "lineItem", "update");
  if (!scope) throw new ForbiddenError();
  if (!ids.length) return { modified: 0 };

  const existing = await LineItem.find({ _id: { $in: ids } }, { projectId: 1 }).lean();
  if (!existing.length) return { modified: 0 };

  if (scope === "own") {
    const owners = await Promise.all(
      [...new Set(existing.map((i: any) => String(i.projectId)))].map(projectOwner)
    );
    if (owners.some((o) => o !== user.id)) {
      throw new ForbiddenError("You can only edit items on your own projects.");
    }
  }

  let safePatch = patch;
  if (user.role === "ops") {
    safePatch = {};
    for (const f of OPS_EDITABLE_FIELDS) if (f in patch) safePatch[f] = patch[f];
  }
  delete safePatch.projectId;
  if (!Object.keys(safePatch).length) return { modified: 0 };

  const res = await LineItem.updateMany({ _id: { $in: ids } }, safePatch);
  const fields = Object.keys(safePatch);
  await writeAudit(user, "lineItem.bulkUpdate", "lineItem", ids.join(","), {
    projectId: String((existing[0] as any).projectId),
    label: `Bulk-updated ${ids.length} content item${ids.length === 1 ? "" : "s"} (${fields.join(", ")})`,
    meta: { count: ids.length, patch: safePatch },
  });
  return { modified: res.modifiedCount ?? 0 };
}

export async function bulkDeleteLineItems(user: CurrentUser, ids: string[]) {
  await connectDB();
  const scope = can(user.role, "lineItem", "delete");
  if (!scope) throw new ForbiddenError();
  if (!ids.length) return { deleted: 0 };

  const existing = await LineItem.find({ _id: { $in: ids } }, { projectId: 1 }).lean();
  if (!existing.length) return { deleted: 0 };

  if (scope === "own") {
    const owners = await Promise.all(
      [...new Set(existing.map((i: any) => String(i.projectId)))].map(projectOwner)
    );
    if (owners.some((o) => o !== user.id)) throw new ForbiddenError();
  }

  const res = await LineItem.deleteMany({ _id: { $in: ids } });
  await writeAudit(user, "lineItem.bulkDelete", "lineItem", ids.join(","), {
    projectId: String((existing[0] as any).projectId),
    label: `Bulk-deleted ${ids.length} content item${ids.length === 1 ? "" : "s"}`,
    meta: { count: ids.length },
  });
  return { deleted: res.deletedCount ?? 0 };
}
