import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { listAudit, listAuditForProject } from "@/features/audit/audit.service";

/**
 * Admin-only. The guard lives in the service (assertCanRead), so this route and
 * the server-rendered page enforce it from the same place — and a direct call
 * by a non-admin lands in the log as auth.denied.
 */
export const GET = withUser(async ({ user, req }) => {
  const q = new URL(req.url).searchParams;

  const projectId = q.get("projectId");
  if (projectId) {
    return NextResponse.json(await listAuditForProject(user, projectId, 100));
  }

  return NextResponse.json(await listAudit(user, {
    actorId: q.get("actorId") ?? undefined,
    resource: q.get("resource") ?? undefined,
    action: q.get("action") ?? undefined,
    from: q.get("from") ?? undefined,
    to: q.get("to") ?? undefined,
    limit: Number(q.get("limit")) || undefined,
  }));
});
