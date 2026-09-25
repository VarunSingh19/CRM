"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { SECTIONS, secShort, toLocalISO } from "@/lib/defaults";
import { fmtShort, MONFULL } from "@/features/documents/templates/shared";
import { Badge, Button, Card, EmptyState, PageHead, stageTone } from "@/components/ui/primitives";
import Icon from "@/components/ui/Icon";

export interface CalendarCard {
  id: string; projectId: string; project: string;
  topic: string; name: string; section: string; status: string;
  recDate: string; relDate: string; cardEnd: string; videoEnd: string; brandEnd: string;
}

/** Same derivation the calendar document uses, so screen and paper agree. */
function stageOf(c: CalendarCard, today: string): string {
  if (c.status === "Cancelled") return "Cancelled";
  if (c.status === "Done") return "Done";
  if (c.cardEnd && c.cardEnd < today) return "Ended";
  if (c.relDate && c.relDate <= today) return "Live";
  if (c.recDate && c.recDate <= today) return "Recorded — in post";
  if (c.recDate || c.relDate) return "To record";
  return "Unscheduled";
}
const STAGES = ["To record", "Recorded — in post", "Live", "Done", "Ended", "Cancelled", "Unscheduled"];

const monthLabel = (ym: string): string =>
  ym ? `${MONFULL[parseInt(ym.slice(5, 7), 10) - 1]} ${ym.slice(0, 4)}` : "All months";

const daysIn = (ym: string): number =>
  new Date(parseInt(ym.slice(0, 4), 10), parseInt(ym.slice(5, 7), 10), 0).getDate();
const dayStr = (ym: string, d: number): string => `${ym}-${String(d).padStart(2, "0")}`;

function shiftMonth(ym: string, by: number): string {
  const y = parseInt(ym.slice(0, 4), 10);
  const m = parseInt(ym.slice(5, 7), 10) - 1 + by;
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ month grid */
function MonthGrid({
  ym, cards, basePath,
}: { ym: string; cards: CalendarCard[]; basePath: string }) {
  const total = daysIn(ym);
  const lead = new Date(parseInt(ym.slice(0, 4), 10), parseInt(ym.slice(5, 7), 10) - 1, 1).getDay();
  const today = toLocalISO(new Date());

  const cells: (number | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="calgrid">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
        <div className="calhead" key={d}>{d}</div>
      ))}

      {cells.map((day, i) => {
        if (day === null) return <div className="calcell empty" key={`x${i}`} />;
        const ds = dayStr(ym, day);
        // Only real events. A card that is merely still live is not drawn —
        // one 90-day card would otherwise fill three months of cells and make
        // a quiet calendar look fully booked. Its run stays in the board view
        // and in the Live-till column of the generated document.
        const recs = cards.filter((c) => c.recDate === ds);
        const rels = cards.filter((c) => c.relDate === ds);
        const ends = cards.filter((c) => c.cardEnd === ds);

        return (
          <div className={`calcell${ds === today ? " today" : ""}`} key={ds}>
            <div className="calday">{day}</div>

            {recs.map((c) => (
              <Link key={`rec${c.id}`} href={`${basePath}/${c.projectId}`} className="calpill rec">
                <span className="mk">●</span>
                <span className="truncate">{c.topic || c.name}</span>
              </Link>
            ))}
            {rels.map((c) => (
              <Link key={`rel${c.id}`} href={`${basePath}/${c.projectId}`} className="calpill rel">
                <span className="mk">▲</span>
                <span className="truncate">{c.topic || c.name}</span>
              </Link>
            ))}
            {ends.map((c) => (
              <Link key={`end${c.id}`} href={`${basePath}/${c.projectId}`} className="calpill end">
                <span className="mk">■</span>
                <span className="truncate">Ends · {c.topic || c.name}</span>
              </Link>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ page */
export default function CalendarView({ cards, basePath }: { cards: CalendarCard[]; basePath: string }) {
  const today = toLocalISO(new Date());
  const [view, setView] = useState<"board" | "calendar">("calendar");
  const [month, setMonth] = useState("");
  const [section, setSection] = useState("");

  // months that actually contain something, newest first
  const months = useMemo(() => {
    const set = new Set<string>();
    for (const c of cards) {
      if (c.relDate) set.add(c.relDate.slice(0, 7));
      if (c.recDate) set.add(c.recDate.slice(0, 7));
    }
    return [...set].sort().reverse();
  }, [cards]);

  // the grid always needs one concrete month, even when the board shows "all"
  const gridMonth = month || today.slice(0, 7);

  const bySection = useMemo(
    () => (section ? cards.filter((c) => c.section === section) : cards),
    [cards, section]
  );

  const filtered = useMemo(() => bySection.filter((c) => {
    if (!month) return true;
    return c.relDate.slice(0, 7) === month || c.recDate.slice(0, 7) === month;
  }), [bySection, month]);

  // Cards with an actual event in this month — a recording, a release or an
  // end. Cards merely still running are excluded, because the grid no longer
  // draws them and counting them would overstate how busy the month is.
  const gridCards = useMemo(
    () => bySection.filter((c) =>
      [c.recDate, c.relDate, c.cardEnd].some((d) => d && d.slice(0, 7) === gridMonth)),
    [bySection, gridMonth]
  );

  const byStage = useMemo(() => {
    const m: Record<string, CalendarCard[]> = {};
    for (const s of STAGES) m[s] = [];
    for (const c of filtered) m[stageOf(c, today)].push(c);
    return m;
  }, [filtered, today]);

  const activeStages = STAGES.filter((s) => byStage[s].length > 0);
  const shown = view === "calendar" ? gridCards.length : filtered.length;

  return (
    <>
      <PageHead
        title="Content calendar"
        subtitle={`${shown} ${shown === 1 ? "card" : "cards"} · ${view === "calendar" ? monthLabel(gridMonth) : monthLabel(month)}`}
      />

      <Card padded={false}>
        <div className="filterbar">
          <div className="segmented" role="group" aria-label="View">
            <button type="button" className={view === "board" ? "on" : ""} onClick={() => setView("board")}>
              Board
            </button>
            <button type="button" className={view === "calendar" ? "on" : ""} onClick={() => setView("calendar")}>
              Calendar
            </button>
          </div>

          {view === "calendar" ? (
            <>
              <Button variant="secondary" size="sm" onClick={() => setMonth(shiftMonth(gridMonth, -1))}
                aria-label="Previous month">
                <Icon name="chevronLeft" size={14} />
              </Button>
              <strong style={{ minWidth: 140, textAlign: "center" }}>{monthLabel(gridMonth)}</strong>
              <Button variant="secondary" size="sm" onClick={() => setMonth(shiftMonth(gridMonth, 1))}
                aria-label="Next month">
                <Icon name="chevronRight" size={14} />
              </Button>
              {gridMonth !== today.slice(0, 7) && (
                <Button variant="ghost" size="sm" onClick={() => setMonth(today.slice(0, 7))}>Today</Button>
              )}
            </>
          ) : (
            <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month">
              <option value="">All months</option>
              {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
          )}

          <select value={section} onChange={(e) => setSection(e.target.value)} aria-label="Media section">
            <option value="">All sections</option>
            {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          {(month || section) && (
            <Button variant="ghost" size="sm" onClick={() => { setMonth(""); setSection(""); }}>Reset</Button>
          )}

          {view === "calendar" && (
            <span className="callegend">
              <span className="rec">●</span> recording
              <span className="rel">▲</span> release
              <span className="live">■</span> card ends
            </span>
          )}
        </div>
      </Card>

      {view === "calendar" ? (
        gridCards.length === 0 ? (
          <Card>
            <EmptyState icon="calendar" title={`Nothing scheduled in ${monthLabel(gridMonth)}`}
              description="Use the arrows to look at another month, or switch to the board for the whole pipeline." />
          </Card>
        ) : (
          <Card padded={false}>
            <MonthGrid ym={gridMonth} cards={gridCards} basePath={basePath} />
          </Card>
        )
      ) : activeStages.length === 0 ? (
        <Card>
          <EmptyState
            icon="calendar"
            title={cards.length ? "Nothing in this view" : "No content scheduled yet"}
            description={cards.length
              ? "Try a different month or section."
              : "Recording and release dates set on a project's content items build this board."}
          />
        </Card>
      ) : (
        <div className="kanban">
          {activeStages.map((stage) => (
            <div className="kcol" key={stage}>
              <h3>
                <Badge tone={stageTone(stage)} dot>{stage}</Badge>
                <span className="n num">{byStage[stage].length}</span>
              </h3>
              {byStage[stage].map((c) => (
                <Link key={c.id} href={`${basePath}/${c.projectId}`} className="kcard"
                  style={{ display: "block", color: "inherit" }}>
                  <div className="t truncate">{c.topic || c.name}</div>
                  <div className="faint truncate">{c.project}</div>
                  <div className="faint truncate" style={{ marginTop: 4 }}>
                    {secShort(c.section)}
                    {c.relDate ? ` · live ${fmtShort(c.relDate)}` : c.recDate ? ` · rec ${fmtShort(c.recDate)}` : ""}
                  </div>
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
