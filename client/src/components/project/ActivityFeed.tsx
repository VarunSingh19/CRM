"use client";
import { Badge, EmptyState, type Tone } from "@/components/ui/primitives";
import { fieldLabel, entrySummary } from "@/features/audit/audit.labels";

export interface ActivityEntry {
  _id: string;
  createdAt: string;
  actorName: string;
  actorRole: string;
  action: string;
  label: string;
  meta?: Record<string, unknown>;
}

function tone(action: string): Tone {
  if (action.includes("delete")) return "bad";
  if (action.includes("create")) return "ok";
  if (action.startsWith("document.")) return "neutral";
  return "info";
}

function stamp(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} · ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
}

/**
 * Everything that has happened to one project, newest first. Answers "who
 * changed this rate?" without leaving the record — the question that otherwise
 * sends someone to another screen and back.
 */
export default function ActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  if (!entries.length) {
    return (
      <EmptyState
        icon="history"
        title="No activity recorded yet"
        description="Edits, content changes and generated documents for this project will appear here."
      />
    );
  }

  return (
    <ol className="feed">
      {entries.map((e) => {
        const changed = (e.meta?.changed ?? null) as Record<string, [unknown, unknown]> | null;
        return (
          <li key={e._id} className="feeditem">
            <span className={`feeddot ${tone(e.action)}`} aria-hidden="true" />
            <div className="feedbody">
              <div className="feedtop">
                <strong>{e.actorName || "Unknown"}</strong>
                {e.actorRole && <span className="faint"> · {e.actorRole}</span>}
                <Badge tone={tone(e.action)}>{e.action}</Badge>
                <span className="spacer" />
                <span className="faint nowrap">{stamp(e.createdAt)}</span>
              </div>
              <div className="feedlabel">{entrySummary(e.action, e.label, e.meta)}</div>
              {changed && Object.keys(changed).length > 1 && (
                <ul className="feedchanges">
                  {Object.entries(changed).map(([k, pair]) => (
                    <li key={k}>
                      <span className="k">{fieldLabel(k)}</span>
                      <span className="was">{pair?.[0] === null || pair?.[0] === undefined ? "empty" : String(pair[0])}</span>
                      <span className="arr">→</span>
                      <span className="now">{pair?.[1] === null || pair?.[1] === undefined ? "empty" : String(pair[1])}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
