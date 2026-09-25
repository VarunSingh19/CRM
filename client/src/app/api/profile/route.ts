import { NextResponse } from "next/server";
import { withUser, readJson } from "@/lib/api";
import { getMyProfile, updateMyProfile } from "@/features/users/user.service";

/**
 * The signed-in user's own profile. No role check: the services are scoped to
 * the caller's own record, so there is nothing here another user could reach.
 */
export const GET = withUser(async ({ user }) => NextResponse.json(await getMyProfile(user)));

export const PATCH = withUser(async ({ user, req }) => {
  const b = await readJson(req);
  // named one by one — never spread the body, or "role" would ride along
  return NextResponse.json(await updateMyProfile(user, {
    name: b.name === undefined ? undefined : String(b.name),
    // email is deliberately not read: it is a sign-in credential, so only an
    // administrator may change it
    currentPassword: b.currentPassword === undefined ? undefined : String(b.currentPassword),
    newPassword: b.newPassword === undefined ? undefined : String(b.newPassword),
  }));
});
