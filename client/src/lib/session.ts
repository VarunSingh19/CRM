import { redirect } from "next/navigation";
import { auth } from "../../auth";
import type { Role } from "./rbac";

export interface CurrentUser {
  id: string;
  name: string;
  username: string;
  role: Role;
}

/** Server-side current user. Throws if not authenticated. */
export async function requireUser(): Promise<CurrentUser> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return {
    id: session.user.id,
    name: session.user.name ?? "",
    username: session.user.username,
    role: session.user.role,
  };
}

export async function getUser(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    name: session.user.name ?? "",
    username: session.user.username,
    role: session.user.role,
  };
}

/**
 * Layout guard. Redirects to /login when signed out, or to the caller's own
 * area when they are signed in but browsing another role's pages. Middleware
 * normally catches both first; this is the second line of defence.
 */
export async function requireRole(area: Role): Promise<CurrentUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.role !== area) redirect(`/${user.role}/dashboard`);
  return user;
}
