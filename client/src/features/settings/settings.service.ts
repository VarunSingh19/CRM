import { connectDB } from "@/lib/db";
import { Settings } from "./settings.model";
import { can, ForbiddenError } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";
import {
  writeAudit,
  diffOf,
  describeChange,
} from "@/features/audit/audit.service";

export async function getSettings() {
  await connectDB();
  let s = (await Settings.findOne({ key: "company" }).lean()) as any;
  if (!s) s = (await Settings.create({ key: "company" })).toObject();
  return s;
}

export async function updateSettings(
  user: CurrentUser,
  patch: Record<string, unknown>,
) {
  await connectDB();
  if (!can(user.role, "settings", "update")) throw new ForbiddenError();
  delete patch.key;
  const existing = (await Settings.findOne({ key: "company" }).lean()) as any;
  const updated = (await Settings.findOneAndUpdate({ key: "company" }, patch, {
    new: true,
    upsert: true,
  }).lean()) as any;
  const changed = diffOf(existing, patch);
  await writeAudit(user, "settings.update", "settings", "company", {
    label: describeChange(changed),
    meta: { changed },
  });
  return updated;
}
