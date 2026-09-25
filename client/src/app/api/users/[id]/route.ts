import { NextResponse } from "next/server";
import { withUser, readJson } from "@/lib/api";
import { updateUser, deactivateUser, deleteUser } from "@/features/users/user.service";

export const PATCH = withUser(async ({ user, req, params }) =>
  NextResponse.json(await updateUser(user, params.id, await readJson(req) as never)));

/**
 * Deactivation is the default, so an ordinary DELETE stays what it always was —
 * the reversible "delete" the Users page offers.
 *
 * Permanent removal is the explicit ?hard=1 opt-in, with ?reassignTo=<id> to
 * hand the account's records to a colleague first. Without it the records are
 * left as they are, which the dialog makes the admin choose deliberately.
 */
export const DELETE = withUser(async ({ user, req, params }) => {
  const sp = new URL(req.url).searchParams;
  if (sp.get("hard") !== "1") return NextResponse.json(await deactivateUser(user, params.id));
  const reassignTo = sp.get("reassignTo") || undefined;
  return NextResponse.json(await deleteUser(user, params.id, { reassignTo }));
});
