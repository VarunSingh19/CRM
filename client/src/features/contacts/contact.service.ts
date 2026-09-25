import { connectDB } from "@/lib/db";
import { Contact } from "./contact.model";
import { Partner } from "@/features/partners/partner.model";
import { normName, type ContactIntent } from "./contact.match";
import { can, ForbiddenError } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";

export type { ContactIntent };

export interface ContactRow {
  _id: string;
  partnerId: string;
  partnerName: string;
  name: string;
  email: string;
  mobile: string;
  /** Is this the partner's present contact, or someone who used to be there? */
  current: boolean;
}

/** Same spelling either way — "R. Menon " and "r. menon" are one person. */
const key = normName;

/**
 * A contact is a detail of a partner, so it inherits partner visibility
 * exactly. Sales sees the partners they own; admin sees all.
 */
export async function listContacts(user: CurrentUser): Promise<ContactRow[]> {
  await connectDB();
  const scope = can(user.role, "partner", "read");
  if (!scope) throw new ForbiddenError();

  const filter: Record<string, unknown> = { archived: false };
  if (scope === "own") filter.ownerId = user.id;

  const partners = (await Partner.find(filter, { name: 1 }).lean()) as any[];
  if (!partners.length) return [];
  const names = new Map(partners.map((p) => [String(p._id), String(p.name ?? "")]));

  const rows = (await Contact.find({ partnerId: { $in: partners.map((p) => p._id) } })
    .sort({ current: -1, name: 1 })
    .lean()) as any[];

  return rows.map((c) => ({
    _id: String(c._id),
    partnerId: String(c.partnerId),
    partnerName: names.get(String(c.partnerId)) ?? "",
    name: String(c.name ?? ""),
    email: String(c.email ?? ""),
    mobile: String(c.mobile ?? ""),
    current: !!c.current,
  }));
}

/**
 * Files a partner's present contact into the directory, called after every
 * partner write so the history maintains itself and nobody has to remember to
 * update it.
 *
 * `intent` is what makes this correct rather than a guess. A changed name means
 * one of two quite different things — the same person's title was fixed, or a
 * new person took the seat — and only the person saving knows which, so the UI
 * asks and passes the answer here:
 *
 *   update — rewrite the row already on record (no second row, no duplicate)
 *   new    — add a row and demote the previous person to history
 *
 * Without an intent (scripts, the backfill) it falls back to matching on name,
 * which is safe because those callers are re-filing what is already stored.
 *
 * Like audit writes, this never throws. It runs after the partner has already
 * been saved, so failing here would report an error for work that succeeded.
 */
export async function recordContact(
  partnerId: string,
  /** A partner record — its `contact` field is the person's name. */
  partner: { contact?: unknown; email?: unknown; mobile?: unknown },
  ownerId?: string,
  intent?: ContactIntent | null
): Promise<void> {
  const name = String(partner.contact ?? "").trim();
  if (!partnerId || !name) return;
  try {
    await connectDB();
    const rows = (await Contact.find({ partnerId }, { name: 1, current: 1 }).lean()) as any[];
    const byName = rows.find((x) => key(x.name) === key(name)) ?? null;

    let target = byName;
    if (intent?.mode === "update") {
      // the row the caller named, else whoever currently holds the seat
      target =
        (intent.contactId ? rows.find((x) => String(x._id) === intent.contactId) : null) ??
        byName ??
        rows.find((x) => x.current) ??
        null;
    } else if (intent?.mode === "new") {
      // a deliberate handover still must not duplicate a name already filed
      // here, or saving twice would leave two rows for one person
      target = byName;
    }

    const fields = {
      name,
      email: String(partner.email ?? "").trim(),
      mobile: String(partner.mobile ?? "").trim(),
      current: true,
    };

    let keepId: unknown;
    if (target) {
      await Contact.updateOne({ _id: target._id }, { $set: fields });
      keepId = target._id;
    } else {
      const created = await Contact.create({
        partnerId,
        ...fields,
        ...(ownerId ? { ownerId } : {}),
      });
      keepId = created._id;
    }

    // whoever held the seat before is now history, not gone
    await Contact.updateMany(
      { partnerId, _id: { $ne: keepId }, current: true },
      { $set: { current: false } }
    );
  } catch (e) {
    console.error("[contacts] record failed:", e);
  }
}

/**
 * Removes one row from the directory, for a contact filed by mistake.
 *
 * Deleting the partner's present contact is refused: it is the person their
 * projects and documents are addressed to, and the way to replace them is to
 * save a new one, which keeps them as history.
 */
export async function removeContact(user: CurrentUser, id: string) {
  await connectDB();
  const scope = can(user.role, "partner", "update");
  if (!scope) throw new ForbiddenError();

  const row = (await Contact.findById(id).lean()) as any;
  if (!row) return { ok: true };

  const partner = (await Partner.findById(row.partnerId).lean()) as any;
  if (scope === "own" && partner && String(partner.ownerId) !== user.id) {
    throw new ForbiddenError("You can only edit your own partners.");
  }
  if (row.current) {
    throw new Error("That is the partner's current contact. Save a new contact person instead — this one is then kept as history.");
  }

  await Contact.findByIdAndDelete(id);
  return { ok: true };
}

/** Removes a deleted partner's directory rows. Same never-throw reasoning. */
export async function forgetPartnerContacts(partnerId: string): Promise<void> {
  try {
    await connectDB();
    await Contact.deleteMany({ partnerId });
  } catch (e) {
    console.error("[contacts] cleanup failed:", e);
  }
}
