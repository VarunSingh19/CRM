import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "./user.model";
import { Project } from "@/features/projects/project.model";
import { Partner } from "@/features/partners/partner.model";
import { Proposal } from "@/features/proposals/proposal.model";
import { Contact } from "@/features/contacts/contact.model";
import { GeneratedDocument } from "@/features/documents/generated-document.model";
import type { Model } from "mongoose";
import { can, ForbiddenError } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";
import {
  writeAudit,
  diffOf,
  describeChange,
} from "@/features/audit/audit.service";

/**
 * Email doubles as a sign-in credential, so a duplicate would make one of the
 * two accounts unreachable by it. Checked here for a readable message; the
 * partial unique index on the collection is the backstop against a race.
 */
async function assertEmailFree(email: string, exceptId?: string) {
  const value = email.trim().toLowerCase();
  if (!value) return;
  const clash = (await User.findOne({
    email: value,
    ...(exceptId ? { _id: { $ne: exceptId } } : {}),
  })
    .select("username")
    .lean()) as any;
  if (clash)
    throw new Error(`“${value}” is already the email on “${clash.username}”.`);
}

export async function listUsers(user: CurrentUser) {
  await connectDB();
  if (!can(user.role, "user", "read")) throw new ForbiddenError();
  return User.find()
    .select("-passwordHash")
    .sort({ role: 1, username: 1 })
    .lean();
}

export async function createUser(
  actor: CurrentUser,
  data: {
    username: string;
    name: string;
    email?: string;
    role: "admin" | "sales" | "ops";
    password: string;
  },
) {
  await connectDB();
  if (!can(actor.role, "user", "create")) throw new ForbiddenError();
  await assertEmailFree(data.email ?? "");
  const passwordHash = await bcrypt.hash(data.password, 10);
  const created = await User.create({
    username: data.username.toLowerCase().trim(),
    name: data.name,
    email: data.email ?? "",
    role: data.role,
    passwordHash,
    active: true,
  });
  await writeAudit(actor, "user.create", "user", String(created._id), {
    label: `Created ${created.role} account “${created.username}” for ${created.name}`,
    meta: {
      username: created.username,
      name: created.name,
      role: created.role,
    },
  });
  const obj = created.toObject();
  delete (obj as Record<string, unknown>).passwordHash;
  return obj;
}

export async function updateUser(
  actor: CurrentUser,
  id: string,
  patch: {
    name?: string;
    email?: string;
    role?: "admin" | "sales" | "ops";
    active?: boolean;
    password?: string;
  },
) {
  await connectDB();
  if (!can(actor.role, "user", "update")) throw new ForbiddenError();
  if (patch.email !== undefined) await assertEmailFree(patch.email, id);
  const set: Record<string, unknown> = {};
  for (const k of ["name", "email", "role", "active"] as const) {
    if (patch[k] !== undefined) set[k] = patch[k];
  }
  if (patch.password) set.passwordHash = await bcrypt.hash(patch.password, 10);
  const before = (await User.findById(id)
    .select("-passwordHash")
    .lean()) as any;
  const updated = (await User.findByIdAndUpdate(id, set, { new: true })
    .select("-passwordHash")
    .lean()) as any;
  // the hash itself never enters the log; that a reset happened does
  const changed = diffOf(before, set);
  delete changed.passwordHash;
  const parts = [describeChange(changed)];
  if (patch.password) parts.push("password reset");
  await writeAudit(actor, "user.update", "user", id, {
    label: `${parts.join("; ")} — on “${before?.username ?? id}”`,
    meta: {
      username: before?.username,
      changed,
      passwordReset: !!patch.password,
    },
  });
  return updated;
}

/**
 * The ordinary delete, and the one the Users page offers first: the row stays,
 * so everything the account owns keeps an owner that resolves. Reversible from
 * the Deleted tab. Permanent removal is deleteUser() below.
 */
export async function deactivateUser(actor: CurrentUser, id: string) {
  await connectDB();
  if (!can(actor.role, "user", "delete")) throw new ForbiddenError();
  if (id === actor.id)
    throw new ForbiddenError("You cannot delete your own account.");
  const updated = (await User.findByIdAndUpdate(
    id,
    { active: false },
    { new: true },
  )
    .select("-passwordHash")
    .lean()) as any;
  await writeAudit(actor, "user.deactivate", "user", id, {
    label: `Deleted “${updated?.username ?? id}” — they can no longer sign in, and the account can be restored`,
    meta: {
      username: updated?.username,
      name: updated?.name,
      role: updated?.role,
    },
  });
  return updated;
}

/**
 * The staff roster behind the Account owner and Production owner pickers.
 *
 * Deliberately not guarded by can(…, "user", "read"): that permission governs
 * user *administration* — logins, emails, creating accounts — and only admin
 * holds it. Sales and ops are the people who actually fill a project in, so
 * gating the roster on it would leave their pickers empty.
 *
 * What leaves the server is therefore narrowed to what a picker needs: the
 * name to write onto the project and the role to sort by. No username, no
 * email, and never the password hash. Deactivated staff are dropped so a
 * closed account cannot be assigned new work.
 */
export async function listAssignableUsers(_user: CurrentUser) {
  await connectDB();
  return User.find({ active: true })
    .select("name role")
    .sort({ name: 1 })
    .lean();
}

/** The signed-in user's own record, for the profile page. */
export async function getMyProfile(user: CurrentUser) {
  await connectDB();
  return User.findById(user.id)
    .select("name username email role active")
    .lean();
}

/**
 * The signed-in user editing their own details.
 *
 * Separate from updateUser() on purpose. That one is account administration —
 * it can hand out roles and deactivate people, so only admin holds it. This one
 * is scoped to the caller's own row and to the single field that is genuinely
 * theirs: their display name.
 *
 * Email is not editable here. It signs people in alongside their username, so
 * changing it changes a credential — someone who edited it to a colleague's
 * address would be taking over the way that colleague signs in. An
 * administrator sets it, where the uniqueness check and the audit trail apply.
 *
 * Role and active are deliberately unreachable here. Reading them off the patch
 * would let any signed-in user promote themselves to admin with a hand-rolled
 * request, which is why the write below names its fields explicitly rather than
 * spreading whatever arrived.
 *
 * A password change re-checks the current one first: a signed-in session left
 * open on a shared desk should not be enough to lock the owner out of it.
 */
export async function updateMyProfile(
  user: CurrentUser,
  patch: {
    name?: string;
    currentPassword?: string;
    newPassword?: string;
  },
) {
  await connectDB();

  const set: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) throw new Error("Your name cannot be blank.");
    set.name = name;
  }

  if (patch.newPassword) {
    if (patch.newPassword.length < 8) {
      throw new Error("Your new password must be at least 8 characters.");
    }
    // select("+passwordHash") — the schema hides it from ordinary reads
    const me = (await User.findById(user.id)
      .select("+passwordHash")
      .lean()) as any;
    if (!me) throw new Error("Your account could not be found.");
    const ok = await bcrypt.compare(
      patch.currentPassword ?? "",
      me.passwordHash ?? "",
    );
    if (!ok) throw new Error("Your current password is not correct.");
    set.passwordHash = await bcrypt.hash(patch.newPassword, 10);
  }

  if (!Object.keys(set).length) return getMyProfile(user);

  const before = (await User.findById(user.id)
    .select("-passwordHash")
    .lean()) as any;
  const updated = (await User.findByIdAndUpdate(user.id, set, { new: true })
    .select("name username email role active")
    .lean()) as any;

  // the hash never enters the log; that a change happened does
  const changed = diffOf(before, set);
  delete changed.passwordHash;
  const parts: string[] = [];
  const described = describeChange(changed);
  if (described) parts.push(described);
  if (set.passwordHash) parts.push("password changed");

  await writeAudit(user, "profile.update", "user", user.id, {
    label: `${parts.join("; ") || "Saved their profile"} — own profile`,
    meta: {
      username: before?.username,
      changed,
      passwordChanged: !!set.passwordHash,
    },
  });
  return updated;
}

/**
 * What each account still owns. One grouped query per collection rather than a
 * count per user, so the Users page costs the same whether there are five
 * accounts or five hundred.
 */
export async function ownershipByUser(actor: CurrentUser) {
  await connectDB();
  if (!can(actor.role, "user", "read")) throw new ForbiddenError();

  const group = async (M: Model<any>, field: string) =>
    M.aggregate([{ $group: { _id: `$${field}`, n: { $sum: 1 } } }]);

  const [projects, partners, proposals] = await Promise.all([
    group(Project, "ownerId"),
    group(Partner, "ownerId"),
    group(Proposal, "ownerId"),
  ]);

  const out: Record<
    string,
    { projects: number; partners: number; proposals: number }
  > = {};
  const put = (rows: any[], key: "projects" | "partners" | "proposals") => {
    for (const r of rows) {
      if (!r._id) continue;
      const k = String(r._id);
      (out[k] ??= { projects: 0, partners: 0, proposals: 0 })[key] = r.n;
    }
  };
  put(projects, "projects");
  put(partners, "partners");
  put(proposals, "proposals");
  return out;
}

/** Everything that carries a user id, and the field that holds it. */
const OWNED: [Model<any>, string][] = [
  [Project, "ownerId"],
  [Partner, "ownerId"],
  [Proposal, "ownerId"],
  [Contact, "ownerId"],
  [GeneratedDocument, "generatedBy"],
];

/**
 * Permanently removes an account. Admin only, and never another administrator.
 *
 * Deactivation is the ordinary retirement and stays reversible; this is the end
 * of the line, for an account that should not have existed or one whose work has
 * been handed on.
 *
 * An admin cannot delete another admin, or themselves. Administrators are the
 * people who hold this button, so letting them remove each other turns a single
 * compromised account into the loss of every other one. Removing an admin means
 * demoting them first, which is a deliberate second step and is itself logged.
 *
 * What happens to their work is the caller's decision, because only a person
 * knows which is right:
 *
 *   reassignTo — hand every project, partner, proposal, contact and generated
 *   document to a named colleague. Nothing is orphaned and the records stay
 *   inside a sales user's own scope.
 *
 *   omitted — delete anyway and leave the records untouched. They keep an owner
 *   id that no longer resolves, so they stay visible to admin and ops but drop
 *   out of any "own records only" scope. That is a real consequence, which is
 *   why it is chosen rather than defaulted to.
 *
 * The audit trail survives either way: entries copy in actorName and actorRole
 * at write time, so what this person did stays readable after the row is gone.
 */
export async function deleteUser(
  actor: CurrentUser,
  id: string,
  opts: { reassignTo?: string } = {},
) {
  await connectDB();
  if (!can(actor.role, "user", "delete")) throw new ForbiddenError();
  if (id === actor.id)
    throw new ForbiddenError("You cannot delete your own account.");

  const target = (await User.findById(id)
    .select("-passwordHash")
    .lean()) as any;
  if (!target) throw new Error("That account no longer exists.");
  if (target.role === "admin") {
    throw new ForbiddenError(
      "Administrators cannot be deleted. Change their role first if the account must go.",
    );
  }

  let moved = 0;
  let heir: any = null;
  if (opts.reassignTo) {
    if (opts.reassignTo === id)
      throw new Error("An account cannot inherit its own records.");
    heir = (await User.findById(opts.reassignTo)
      .select("name username active")
      .lean()) as any;
    if (!heir) throw new Error("The colleague you picked no longer exists.");
    if (heir.active === false)
      throw new Error(
        `“${heir.username}” is deactivated and cannot take on new records.`,
      );

    const results = await Promise.all(
      OWNED.map(([M, field]) =>
        M.updateMany({ [field]: id }, { $set: { [field]: opts.reassignTo } }),
      ),
    );
    moved = results.reduce((n, r: any) => n + (r?.modifiedCount ?? 0), 0);
  }

  await User.findByIdAndDelete(id);
  await writeAudit(actor, "user.delete", "user", id, {
    label: heir
      ? `Permanently deleted “${target.username}” (${target.role}) — ${moved} record${moved === 1 ? "" : "s"} reassigned to “${heir.username}”`
      : `Permanently deleted “${target.username}” (${target.role}) — their records were left as they are`,
    meta: {
      username: target.username,
      name: target.name,
      role: target.role,
      email: target.email,
      reassignedTo: heir?.username ?? null,
      recordsMoved: moved,
    },
  });
  return {
    ok: true,
    username: target.username,
    moved,
    reassignedTo: heir?.username ?? null,
  };
}
