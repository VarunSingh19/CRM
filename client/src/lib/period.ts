import { toLocalISO } from "./defaults";

export type PeriodKey =
  | "all"
  | "today"
  | "7d"
  | "30d"
  | "month"
  | "fy"
  | "custom";

export interface Period {
  key: PeriodKey;
  /** yyyy-mm-dd, inclusive. Absent means unbounded. */
  from?: string;
  to?: string;
  label: string;
}

export const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "month", label: "This month" },
  { key: "fy", label: "This financial year" },
  { key: "custom", label: "Custom range" },
];

function daysAgo(n: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return toLocalISO(d);
}

const fmt = (d: string): string => {
  const dt = new Date(d + "T00:00:00");
  return isNaN(+dt)
    ? d
    : `${String(dt.getDate()).padStart(2, "0")} ${
        [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ][dt.getMonth()]
      } ${dt.getFullYear()}`;
};

/**
 * Turn URL params into a concrete date window. Unknown keys fall back to all
 * time, and a custom range missing both ends does too, so a hand-edited URL
 * can never produce an empty dashboard by accident.
 */
export function resolvePeriod(
  key?: string,
  from?: string,
  to?: string,
): Period {
  const today = toLocalISO(new Date());

  switch (key) {
    case "today":
      return { key: "today", from: today, to: today, label: "Today" };
    case "7d":
      return { key: "7d", from: daysAgo(6), to: today, label: "Last 7 days" };
    case "30d":
      return {
        key: "30d",
        from: daysAgo(29),
        to: today,
        label: "Last 30 days",
      };
    case "month": {
      const d = new Date();
      const first = toLocalISO(new Date(d.getFullYear(), d.getMonth(), 1));
      return { key: "month", from: first, to: today, label: "This month" };
    }
    case "fy": {
      // Indian financial year: 1 April through 31 March
      const d = new Date();
      const startYear =
        d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
      return {
        key: "fy",
        from: `${startYear}-04-01`,
        to: `${startYear + 1}-03-31`,
        label: `FY ${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`,
      };
    }
    case "custom": {
      if (!from && !to) return { key: "all", label: "All time" };
      const label =
        from && to
          ? `${fmt(from)} — ${fmt(to)}`
          : from
            ? `From ${fmt(from)}`
            : `Up to ${fmt(to as string)}`;
      return {
        key: "custom",
        from: from || undefined,
        to: to || undefined,
        label,
      };
    }
    default:
      return { key: "all", label: "All time" };
  }
}

/** Mongo filter fragment for a yyyy-mm-dd string field. */
export function dateRangeFilter(p: Period): Record<string, unknown> | null {
  if (!p.from && !p.to) return null;
  const range: Record<string, string> = {};
  if (p.from) range.$gte = p.from;
  if (p.to) range.$lte = p.to;
  return range;
}
