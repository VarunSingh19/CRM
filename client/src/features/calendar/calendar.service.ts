import { connectDB } from "@/lib/db";
import { Project } from "@/features/projects/project.model";
import { LineItem } from "@/features/line-items/line-item.model";
import { can, ForbiddenError, redactLineItemFor } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";

export interface CalendarCard {
  id: string; project: string; projectId: string;
  topic: string; name: string; section: string; status: string;
  recDate: string; relDate: string; cardEnd: string; videoEnd: string; brandEnd: string;
}

/** Full-pipeline content calendar (Kanban columns + date-keyed month view). */
export async function getCalendar(user: CurrentUser) {
  await connectDB();
  if (!can(user.role, "calendar", "read")) throw new ForbiddenError();

  const projects = await Project.find({ archived: false }, { projName: 1 }).lean();
  const nameOf = new Map(projects.map((p) => [String(p._id), p.projName as string]));
  // only the fields the board renders; inclusion/exclusion text is large and unused here
  const items = await LineItem.find(
    { projectId: { $in: projects.map((p) => p._id) } },
    {
      projectId: 1, topic: 1, name: 1, section: 1, status: 1, cardName: 1,
      recDate: 1, relDate: 1, cardEnd: 1, videoEnd: 1, brandEnd: 1,
    }
  ).sort({ relDate: 1, recDate: 1 }).lean();

  const cards: CalendarCard[] = items.map((raw) => {
    const it = redactLineItemFor(user.role, raw as Record<string, unknown>);
    return {
      id: String(it._id), projectId: String(it.projectId),
      project: nameOf.get(String(it.projectId)) ?? "—",
      topic: (it.topic as string) || "", name: it.name as string,
      section: it.section as string, status: it.status as string,
      recDate: (it.recDate as string) || "", relDate: (it.relDate as string) || "",
      cardEnd: (it.cardEnd as string) || "", videoEnd: (it.videoEnd as string) || "",
      brandEnd: (it.brandEnd as string) || "",
    };
  });

  const kanban: Record<string, CalendarCard[]> = { Planner: [], "In Progress": [], Done: [], Cancelled: [] };
  for (const c of cards) (kanban[c.status] ??= []).push(c);

  return { kanban, cards };
}
