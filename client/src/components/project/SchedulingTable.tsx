"use client";
import { STATUSES, secShort } from "@/lib/defaults";
import { Badge, EmptyState, statusTone } from "@/components/ui/primitives";
import type { Item } from "./types";

const DATE_COLS: [keyof Item, string][] = [
  ["recDate", "Recording"], ["relDate", "Release"],
  ["cardEnd", "Card end"], ["videoEnd", "Video end"], ["brandEnd", "Branding end"],
];

/**
 * Every date for every card on one grid. This is the screen production works
 * from, so it stays editable in place rather than one card at a time.
 */
export default function SchedulingTable({
  items, dirty, onPatch,
}: {
  items: Item[];
  dirty: Record<string, boolean>;
  onPatch: (id: string, key: keyof Item, value: unknown) => void;
}) {
  if (!items.length) {
    return (
      <EmptyState
        icon="calendar"
        title="No content to schedule"
        description="Add content items first, then set their recording, release and end dates here."
      />
    );
  }

  return (
    <div className="tablewrap">
      <table className="dt">
        <thead>
          <tr>
            <th style={{ width: 34 }}>#</th>
            <th style={{ minWidth: 190 }}>Content</th>
            <th style={{ width: 160 }}>Card name</th>
            <th style={{ width: 140 }}>Status</th>
            {DATE_COLS.map(([, label]) => (
              <th key={label} style={{ width: 150 }}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={it._id}>
              <td className="faint">{i + 1}</td>
              <td>
                <div className="truncate" style={{ fontWeight: 600, maxWidth: 260 }}>
                  {it.topic || it.projDesc || it.name}
                </div>
                <div className="faint truncate" style={{ maxWidth: 260 }}>
                  {secShort(it.section)} · {it.name}
                  {dirty[it._id] && <Badge tone="warn">unsaved</Badge>}
                </div>
              </td>
              <td>
                <input value={it.cardName ?? ""} placeholder="Name on the card"
                  onChange={(e) => onPatch(it._id, "cardName", e.target.value)} />
              </td>
              <td>
                <select value={it.status} onChange={(e) => onPatch(it._id, "status", e.target.value)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
              {DATE_COLS.map(([key]) => (
                <td key={String(key)}>
                  <input type="date" value={(it[key] as string) ?? ""}
                    onChange={(e) => onPatch(it._id, key, e.target.value)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="tablefoot">
        <span>
          Every end date raises a daily reminder from two days before until the date itself.
          Download the .ics from the Documents tab.
        </span>
        <div className="spacer" />
        <span>
          <Badge tone={statusTone("Done")} dot>
            {items.filter((i) => i.status === "Done").length} done
          </Badge>
        </span>
      </div>
    </div>
  );
}
