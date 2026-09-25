import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getDashboard } from "@/features/dashboard/dashboard.service";
import { money } from "@/lib/money";
import { fmtDate } from "@/features/documents/templates/shared";
import { Badge, Card, EmptyState, PageHead, statusTone } from "@/components/ui/primitives";
import PeriodFilter from "@/components/dashboard/PeriodFilter";
import NewProjectButton from "@/components/project/NewProjectButton";
import { resolvePeriod, type PeriodKey } from "@/lib/period";
import { can } from "@/lib/rbac";
import Icon from "@/components/ui/Icon";

/**
 * Fully server-rendered: the numbers arrive inside the HTML and this page
 * ships no client JavaScript of its own.
 */

export default async function DashboardPage(
  { searchParams }: { searchParams?: Record<string, string | string[] | undefined> }
) {
  const user = await requireUser();
  const one = (k: string): string | undefined => {
    const v = searchParams?.[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const period = resolvePeriod(one("period"), one("from"), one("to"));
  const d = await getDashboard(user, period);
  const base = `/${user.role}`;
  const showMoney = d.revenueInFlight !== undefined;

  const greeting = user.name ? `Welcome back, ${user.name.split(" ")[0]}` : "Overview";

  return (
    <>
      <PageHead
        title="Dashboard"
        // subtitle={`${greeting} · ${d.projectCount} ${d.projectCount === 1 ? "project" : "projects"} · ${d.periodLabel}`}
        subtitle={`${greeting} `}
        actions={
          <>
            <PeriodFilter periodKey={period.key as PeriodKey} label={period.label}
              from={period.from} to={period.to} />
            {can(user.role, "project", "create") && <NewProjectButton basePath={base + "/projects"} />}
          </>
        }
      />

      {d.undatedCount > 0 && (
        <p className="muted" style={{ marginTop: -8, marginBottom: 14 }}>
          {d.undatedCount} {d.undatedCount === 1 ? "project has" : "projects have"} no date set,
          so {d.undatedCount === 1 ? "it is" : "they are"} not counted in this period.
        </p>
      )}

      <div className="statgrid">
        <div className="stat" tabIndex={0} data-tip="Active projects whose document date falls in the selected period. Archived projects are never counted.">
          <span className="sico"><Icon name="projects" size={16} /></span>
          <div className="l">Projects</div>
          <div className="n">{d.projectCount}</div>
          <div className="d">{user.role === "sales" ? "Owned by you" : "Across the team"}</div>
        </div>
        <div className="stat" tabIndex={0} data-tip="Every content card across those projects — Daily Pulse, EMA and Media Services combined.">
          <span className="sico"><Icon name="catalog" size={16} /></span>
          <div className="l">Content</div>
          <div className="n">{d.itemCount}</div>
          <div className="d">{d.statusCounts["Planner"] ?? 0} still in planner</div>
        </div>
        <div className="stat" tabIndex={0} data-tip="Cards actively being worked on: recorded and in post, or live but not yet marked Done.">
          <span className="sico"><Icon name="edit" size={16} /></span>
          <div className="l">In progress</div>
          <div className="n">{d.statusCounts["In Progress"] ?? 0}</div>
          <div className="d">{d.statusCounts["Done"] ?? 0} delivered</div>
        </div>
        <div className="stat" tabIndex={0}
          data-tip="Milestone dates that have already passed on cards not yet Done or Cancelled — recording, release, card end, video end or branding end.">
          <span className="sico"><Icon name="alert" size={16} /></span>
          <div className="l">Pending</div>
          <div className="n">{d.overdueCount}</div>
          <div className="d">{d.overdueCount ? "Needs attention today" : "Nothing past due"}</div>
        </div>
      </div>

      {showMoney && (
        <div style={{ marginTop: 16 }}>
          <Card title="Revenue Performance">
            <div className="revgrid">
              <div className="revtile incoming" tabIndex={0}
                data-tip="Net value of cards not yet delivered. Excludes GST, cancelled cards and work already marked Done.">
                <div className="l">Incoming</div>
                <div className="n">{money(d.revenueInFlight ?? 0)}</div>
                <div className="d">Excluding tax, cancelled and delivered</div>
              </div>
              <div className="revtile delivered" tabIndex={0}
                data-tip="Net value of cards marked Done, excluding GST.">
                <div className="l">Delivered</div>
                <div className="n">{money(d.revenueWon ?? 0)}</div>
                <div className="d">Content marked done</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="grid k2" style={{ marginTop: 16 }}>
        <Card title="Content pipeline">
          {Object.entries(d.statusCounts).map(([s, n]) => (
            <div className="lrow" key={s}
              style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
              <Badge tone={statusTone(s)} dot>{s}</Badge>
              <span className="num" style={{ fontWeight: 600 }}>{n}</span>
            </div>
          ))}
        </Card>

        <Card title="By media section">
          {Object.keys(d.sectionCounts).length === 0 ? (
            <p className="muted">No content added yet.</p>
          ) : (
            Object.entries(d.sectionCounts).map(([s, n]) => (
              <div key={s} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                <span>{s}</span>
                <span className="num" style={{ fontWeight: 600 }}>{n}</span>
              </div>
            ))
          )}
        </Card>
      </div>

      <Card
        title="Upcoming events"
        padded={false}
        actions={<span className="muted">Next 14 days</span>}
      >
        {d.upcoming.length === 0 ? (
          <EmptyState
            icon="calendar"
            title="Nothing due in the next two weeks"
            description="Recording, release and end dates you set on content items will appear here."
          />
        ) : (
          <>
            {/* A 4-column table has no room on a phone, so below 640px this
                swaps for a stacked card per row — same data, CSS-only toggle. */}
            <div className="tablewrap uptable">
              <table className="dt">
                <thead>
                  <tr>
                    <th style={{ width: 120 }}>Date</th>
                    <th style={{ width: 120 }}>Activity</th>
                    <th>Content</th>
                    <th>Project</th>
                  </tr>
                </thead>

                <tbody>
                  {d.upcoming.map((u, i) => (
                    <tr key={`${u.projectId}-${u.kind}-${u.date}-${i}`}>
                      <td className="nowrap">
                        {/* Show alert icon only for the first 3 overdue items */}
                        {u.overdue && i < 3 && (
                          <span
                            style={{ color: "var(--bad)", marginRight: 6 }}
                          >
                            <Icon name="alert" size={13} />
                          </span>
                        )}

                        {fmtDate(u.date)}
                      </td>

                      <td>{u.kind}</td>
                      <td className="truncate">{u.item}</td>
                      <td>
                        <Link href={`${base}/projects/${u.projectId}`}>
                          {u.project}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="upcards">
              {d.upcoming.map((u, i) => (
                <div className="upcard" key={`${u.projectId}-${u.kind}-${u.date}-${i}`}>
                  <div className="uphead">
                    <Link href={`${base}/projects/${u.projectId}`} className="truncate">
                      {u.project}
                    </Link>
                  </div>
                  {u.item && <div className="upitem truncate">{u.item}</div>}
                  <div className="upfoot">
                    <span className="nowrap">
                      {u.overdue && i < 3 && (
                        <span style={{ color: "var(--bad)", marginRight: 6 }}>
                          <Icon name="alert" size={13} />
                        </span>
                      )}
                      {fmtDate(u.date)}
                    </span>
                    <Badge tone="neutral">{u.kind}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </>
  );
}
