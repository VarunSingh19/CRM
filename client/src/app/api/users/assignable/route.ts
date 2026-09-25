import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { listAssignableUsers } from "@/features/users/user.service";

/**
 * The staff roster for the owner pickers. Open to any signed-in user — see
 * listAssignableUsers() for why this sits apart from /api/users, which stays
 * admin-only because it carries logins and emails.
 */
export const GET = withUser(async ({ user }) => NextResponse.json(await listAssignableUsers(user)));
