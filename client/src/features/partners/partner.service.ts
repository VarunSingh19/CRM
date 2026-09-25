import { connectDB } from "@/lib/db";
import { Partner } from "./partner.model";
import { can, ForbiddenError } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";
import { writeAudit, diffOf, describeChange } from "@/features/audit/audit.service";
import { recordContact, forgetPartnerContacts, type ContactIntent } from "@/features/contacts/contact.service";

/**
 * The UI sends its answer to "same person, or a new one?" alongside the patch.
 * It is not a field on Partner, so it is lifted out before the write.
 */
function takeContactIntent(patch: Record<string, unknown>): ContactIntent | null {
  const raw = patch.contactIntent as { mode?: unknown; contactId?: unknown } | undefined;
  delete patch.contactIntent;
  if (raw?.mode !== "update" && raw?.mode !== "new") return null;
  return {
    mode: raw.mode,
    ...(typeof raw.contactId === "string" && raw.contactId ? { contactId: raw.contactId } : {}),
  };
}

export async function listPartners(user: CurrentUser) {
  await connectDB();
  const scope = can(user.role, "partner", "read");
  if (!scope) throw new ForbiddenError();
  const filter: Record<string, unknown> = { archived: false };
  if (scope === "own") filter.ownerId = user.id;
  return Partner.find(filter).sort({ name: 1 }).lean();
}

export async function createPartner(user: CurrentUser, data: Record<string, unknown>) {
  await connectDB();
  if (!can(user.role, "partner", "create")) throw new ForbiddenError();
  takeContactIntent(data); // a brand-new partner has no history to choose against
  const partner = await Partner.create({ ...data, ownerId: user.id });
  await recordContact(String(partner._id), partner, user.id);
  await writeAudit(user, "partner.create", "partner", String(partner._id), {
    label: `Created partner “${partner.name}”`,
    meta: { name: partner.name, type: partner.type, email: partner.email },
  });
  return partner.toObject();
}

export async function updatePartner(user: CurrentUser, id: string, patch: Record<string, unknown>) {
  await connectDB();
  const scope = can(user.role, "partner", "update");
  if (!scope) throw new ForbiddenError();
  const existing = await Partner.findById(id).lean() as any;
  if (!existing) return null;
  if (scope === "own" && String(existing.ownerId) !== user.id) {
    throw new ForbiddenError("You can only edit your own partners.");
  }
  delete patch.ownerId;
  const intent = takeContactIntent(patch);
  const updated = await Partner.findByIdAndUpdate(id, patch, { new: true }).lean() as any;
  // Only when the person actually moved or their details were edited — an
  // address-only save should not disturb the directory.
  if (updated && ["contact", "email", "mobile"].some((k) => k in patch)) {
    await recordContact(id, updated, String(existing.ownerId ?? user.id), intent);
  }
  const changed = diffOf(existing, patch);
  await writeAudit(user, "partner.update", "partner", id, {
    label: `${describeChange(changed)} — on “${existing.name}”`,
    meta: { name: existing.name, changed },
  });
  return updated;
}

export async function deletePartner(user: CurrentUser, id: string) {
  await connectDB();
  if (!can(user.role, "partner", "delete")) throw new ForbiddenError();
  const existing = await Partner.findById(id).lean() as any;
  await Partner.findByIdAndDelete(id);
  await forgetPartnerContacts(id);
  await writeAudit(user, "partner.delete", "partner", id, {
    label: `Deleted partner “${existing?.name ?? id}”`,
    meta: existing
      ? { name: existing.name, type: existing.type, email: existing.email, gstin: existing.gstin }
      : {},
  });
  return { ok: true };
}
