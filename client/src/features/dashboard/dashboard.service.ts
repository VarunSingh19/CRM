import { connectDB } from "@/lib/db";
import { Project } from "@/features/projects/project.model";
import { LineItem } from "@/features/line-items/line-item.model";
import { Partner } from "@/features/partners/partner.model";
import { calcLine } from "@/lib/money";
import { canSeeMoney } from "@/lib/rbac";
import { toLocalISO } from "@/lib/defaults";
import { dateRangeFilter, type Period } from "@/lib/period";
import type { CurrentUser } from "@/lib/session";

const STATUSES = ["Planner", "In Progress", "Done", "Cancelled"] as const;

const MILESTONES = [
  ["Record", "recDate"], ["Release", "relDate"], ["Card end", "cardEnd"],
  ["Video end", "videoEnd"], ["Brand end", "brandEnd"],
] as const;

export interface UpcomingRow {
  projectId: string; project: string; item: string;
  kind: string; date: string; overdue: boolean;
}

export interface DashboardData {
  role: string;
  projectCount: number;
  itemCount: number;
  statusCounts: Record<string, number>;
  sectionCounts: Record<string, number>;
  upcoming: UpcomingRow[];
  overdueCount: number;
  revenueInFlight?: number;
  revenueWon?: number;
  partnerCount?: number;
  /** Echoed back so the page can label what it is showing. */
  periodLabel: string;
  /** Projects with no date at all, therefore outside any dated window. */
  undatedCount: number;
}

/**
 * Counts are grouped in MongoDB rather than in Node, and the row fetch is
 * projected down to the fields the dashboard actually reads — the scope text
 * fields on a line item are far larger than everything else combined.
 */
export async function getDashboard(user: CurrentUser, period: Period): Promise<DashboardData> {
  await connectDB();

  const projectFilter: Record<string, unknown> = { archived: false };
  if (user.role === "sales") projectFilter.ownerId = user.id;

  // The window applies to the project's own document date. A project with no
  // date cannot be placed in time, so it drops out of any dated window — the
  // count is surfaced so that exclusion is visible rather than silent.
  const range = dateRangeFilter(period);
  const undatedCount = range
    ? await Project.countDocuments({ ...projectFilter, $or: [{ date: "" }, { date: { $exists: false } }] })
    : 0;
  if (range) projectFilter.date = range;

  const projects = await Project.find(projectFilter, { projName: 1 }).lean();
  const projectIds = projects.map((p) => p._id);
  const projName = new Map(projects.map((p) => [String(p._id), p.projName as string]));

  const showMoney = canSeeMoney(user.role);

  const [grouped, rows, partnerCount] = await Promise.all([
    LineItem.aggregate([
      { $match: { projectId: { $in: projectIds } } },
      { $group: { _id: { status: "$status", section: "$section" }, n: { $sum: 1 } } },
    ]),
    LineItem.find(
      { projectId: { $in: projectIds } },
      {
        projectId: 1, topic: 1, name: 1, status: 1,
        recDate: 1, relDate: 1, cardEnd: 1, videoEnd: 1, brandEnd: 1,
        ...(showMoney ? { qty: 1, rate: 1, discType: 1, discValue: 1, amountOverride: 1 } : {}),
      }
    ).lean(),
    showMoney
      ? Partner.countDocuments(user.role === "sales"
        ? { ownerId: user.id, archived: false }
        : { archived: false })
      : Promise.resolve(undefined),  // partners are a standing list, not period-bound
  ]);

  const statusCounts: Record<string, number> = {};
  for (const s of STATUSES) statusCounts[s] = 0;
  const sectionCounts: Record<string, number> = {};
  let itemCount = 0;
  for (const g of grouped as { _id: { status: string; section: string }; n: number }[]) {
    statusCounts[g._id.status] = (statusCounts[g._id.status] ?? 0) + g.n;
    sectionCounts[g._id.section] = (sectionCounts[g._id.section] ?? 0) + g.n;
    itemCount += g.n;
  }

  const today = toLocalISO(new Date());
  const horizonDate = new Date();
  horizonDate.setDate(horizonDate.getDate() + 14);
  const horizon = toLocalISO(horizonDate);

  const upcoming: UpcomingRow[] = [];
  let inFlight = 0, won = 0;

  for (const it of rows) {
    const status = it.status as string;

    if (status !== "Cancelled" && status !== "Done") {
      for (const [kind, key] of MILESTONES) {
        const d = String(it[key] ?? "");
        if (!d || d > horizon) continue;
        upcoming.push({
          projectId: String(it.projectId),
          project: projName.get(String(it.projectId)) ?? "—",
          item: (it.topic as string) || (it.name as string),
          kind, date: d, overdue: d < today,
        });
      }
    }

    if (showMoney) {
      const net = calcLine({
        qty: it.qty as number, rate: it.rate as number,
        discType: it.discType as "amount" | "percent", discValue: it.discValue as number,
        amountOverride: it.amountOverride as number | "",
      }).net;
      if (status === "Done") won += net;
      else if (status !== "Cancelled") inFlight += net;
    }
  }

  upcoming.sort((a, b) => a.date.localeCompare(b.date));

  return {
    role: user.role,
    projectCount: projects.length,
    itemCount,
    statusCounts,
    sectionCounts,
    upcoming: upcoming.slice(0, 30),
    overdueCount: upcoming.filter((u) => u.overdue).length,
    periodLabel: period.label,
    undatedCount,
    ...(showMoney ? { revenueInFlight: inFlight, revenueWon: won, partnerCount } : {}),
  };
}
