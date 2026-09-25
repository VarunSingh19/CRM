import { requireUser } from "@/lib/session";
import { listProjects } from "@/features/projects/project.service";
import { can } from "@/lib/rbac";
import { serialize } from "@/lib/serialize";
import ProjectsListView, { type ProjectRow } from "@/components/views/ProjectsListView";

export default async function ProjectsPage() {
  const user = await requireUser();
  const rows = await listProjects(user);
  return (
    <ProjectsListView
      rows={serialize(rows) as unknown as ProjectRow[]}
      basePath={`/${user.role}/projects`}
      canCreate={!!can(user.role, "project", "create")}
      canDelete={!!can(user.role, "project", "delete")}
      currentUserId={user.id}
    />
  );
}
