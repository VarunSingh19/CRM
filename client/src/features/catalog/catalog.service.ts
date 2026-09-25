import { connectDB } from "@/lib/db";
import { Offering } from "./offering.model";
import { can, ForbiddenError } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";
import { writeAudit, diffOf, describeChange } from "@/features/audit/audit.service";

export async function listOfferings(user: CurrentUser) {
  await connectDB();
  if (!can(user.role, "catalog", "read")) throw new ForbiddenError();
  return Offering.find({ active: true }).sort({ section: 1, sortOrder: 1, name: 1 }).lean();
}

export async function createOffering(user: CurrentUser, data: Record<string, unknown>) {
  await connectDB();
  if (!can(user.role, "catalog", "create")) throw new ForbiddenError();
  const off = await Offering.create(data);
  await writeAudit(user, "catalog.create", "catalog", String(off._id), {
    label: `Added offering “${off.name}”`,
    meta: { name: off.name, section: off.section },
  });
  return off.toObject();
}

export async function updateOffering(user: CurrentUser, id: string, patch: Record<string, unknown>) {
  await connectDB();
  if (!can(user.role, "catalog", "update")) throw new ForbiddenError();
  const existing = await Offering.findById(id).lean() as any;
  const updated = await Offering.findByIdAndUpdate(id, patch, { new: true }).lean() as any;
  const changed = diffOf(existing, patch);
  await writeAudit(user, "catalog.update", "catalog", id, {
    label: `${describeChange(changed)} — on “${existing?.name ?? id}”`,
    meta: { name: existing?.name, changed },
  });
  return updated;
}

export async function deleteOffering(user: CurrentUser, id: string) {
  await connectDB();
  if (!can(user.role, "catalog", "delete")) throw new ForbiddenError();
  // soft delete to avoid breaking historical line items
  const existing = await Offering.findById(id).lean() as any;
  await Offering.findByIdAndUpdate(id, { active: false });
  await writeAudit(user, "catalog.delete", "catalog", id, {
    label: `Retired offering “${existing?.name ?? id}” (deactivated, not erased)`,
    meta: { name: existing?.name, section: existing?.section },
  });
  return { ok: true };
}
