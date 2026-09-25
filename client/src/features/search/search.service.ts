import { connectDB } from "@/lib/db";
import { Project } from "@/features/projects/project.model";
import { LineItem } from "@/features/line-items/line-item.model";
import { Partner } from "@/features/partners/partner.model";
import { can } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";

export interface SearchHit {
  id: string;
  group: "Projects" | "Partners" | "Content";
  title: string;
  meta: string;
  href: string;
}

/** Escape user input before it reaches a RegExp — never build one from raw text. */
function safeRegex(q: string): RegExp {
  return new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

const LIMIT = 6;

/**
 * Cross-module lookup for the command palette. Each module is queried only if
 * the caller's role may read it, and results link into that role's own area.
 */
export async function search(
  user: CurrentUser,
  qRaw: string,
): Promise<SearchHit[]> {
  const q = qRaw.trim();
  if (q.length < 2) return [];
  await connectDB();

  const rx = safeRegex(q);
  const base = `/${user.role}`;
  const tasks: Promise<SearchHit[]>[] = [];

  if (can(user.role, "project", "read")) {
    tasks.push(
      Project.find(
        {
          archived: false,
          $or: [{ projName: rx }, { cName: rx }, { estNo: rx }],
        },
        { projName: 1, cName: 1, estNo: 1 },
      )
        .sort({ updatedAt: -1 })
        .limit(LIMIT)
        .lean()
        .then((rows) =>
          rows.map((p) => ({
            id: String(p._id),
            group: "Projects" as const,
            title: (p.projName as string) || "Untitled project",
            meta: [p.cName, p.estNo].filter(Boolean).join(" · "),
            href: `${base}/projects/${String(p._id)}`,
          })),
        ),
    );
  }

  if (can(user.role, "partner", "read")) {
    tasks.push(
      Partner.find(
        { archived: false, $or: [{ name: rx }, { email: rx }] },
        { name: 1, type: 1, email: 1 },
      )
        .sort({ name: 1 })
        .limit(LIMIT)
        .lean()
        .then((rows) =>
          rows.map((p) => ({
            id: String(p._id),
            group: "Partners" as const,
            title: p.name as string,
            meta: [p.type, p.email].filter(Boolean).join(" · "),
            // ?focus tells the list which row to page to and highlight, so the
            // search does not have to be repeated once you land there
            href: `${base}/partners?focus=${String(p._id)}`,
          })),
        ),
    );
  }

  if (can(user.role, "lineItem", "read")) {
    tasks.push(
      LineItem.find(
        { $or: [{ topic: rx }, { cardName: rx }, { name: rx }] },
        { topic: 1, cardName: 1, name: 1, section: 1, status: 1, projectId: 1 },
      )
        .sort({ updatedAt: -1 })
        .limit(LIMIT)
        .lean()
        .then((rows) =>
          rows.map((i) => ({
            id: String(i._id),
            group: "Content" as const,
            title:
              (i.topic as string) ||
              (i.cardName as string) ||
              (i.name as string),
            meta: [i.name, i.status].filter(Boolean).join(" · "),
            href: `${base}/projects/${String(i.projectId)}?tab=content&focus=${String(i._id)}`,
          })),
        ),
    );
  }

  const results = await Promise.all(tasks);
  return results.flat();
}
