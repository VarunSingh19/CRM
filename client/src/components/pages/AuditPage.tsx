import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { listAudit, listAuditActors } from "@/features/audit/audit.service";
import { serialize } from "@/lib/serialize";
import AuditLogView, { type AuditRow } from "@/components/views/AuditLogView";

/**
 * Server-rendered: the entries arrive inside the HTML. Coarse filters live in
 * the URL so a filtered view is shareable and re-queries the database.
 */
export default async function AuditPage(
  { searchParams }: { searchParams?: Record<string, string | string[] | undefined> }
) {
  const user = await requireUser();
  // The layout already guards /admin, but this page reads every role's activity
  // so it checks the permission itself rather than trusting where it is mounted.
  if (!can(user.role, "auditLog", "read")) redirect(`/${user.role}/dashboard`);

  const one = (k: string): string | undefined => {
    const v = searchParams?.[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const [rows, actors] = await Promise.all([
    listAudit(user, {
      resource: one("resource"),
      actorId: one("actor"),
      action: one("action"),
      from: one("from"),
      to: one("to"),
    }),
    listAuditActors(user),
  ]);

  return (
    <AuditLogView
      rows={serialize(rows) as unknown as AuditRow[]}
      actors={serialize(actors) as { id: string; name: string }[]}
      basePath={`/${user.role}`}
    />
  );
}
