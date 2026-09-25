import {
  DocData,
  DocItem,
  docShell,
  letterhead,
  partyBlock,
  sect,
  stampRow,
  esc,
  fmtShort,
  na,
  secShort,
  topicOf,
  toLocalISO,
  PROJ,
  or,
  MONFULL,
  T_CAL,
  T_PLAIN,
  th,
  td,
  tdC,
  S,
} from "./_reexport";

/* ---------------------------------------------------------------- month helpers */
export function calMonthValue(f: DocData): string {
  if (f.calMonth) return f.calMonth;
  const dates = f.items
    .map((it) => it.relDate || it.recDate)
    .filter(Boolean)
    .sort();
  return dates.length
    ? dates[0].slice(0, 7)
    : toLocalISO(new Date()).slice(0, 7);
}
const inMonth = (d: string, ym: string): boolean => !!d && d.slice(0, 7) === ym;
const ymDays = (ym: string): number =>
  new Date(
    parseInt(ym.slice(0, 4), 10),
    parseInt(ym.slice(5, 7), 10),
    0,
  ).getDate();
const dayStr = (ym: string, d: number): string =>
  ym + "-" + String(d).padStart(2, "0");

/* ---------------------------------------------------------------- the three markers */
type Kind = "rec" | "rel" | "live" | "end";
const SYM: Record<Kind, { ch: string; color: string; label: string }> = {
  rec: { ch: "●", color: "#136EB6", label: "Recording" }, // filled circle
  rel: { ch: "▲", color: "#F47C22", label: "Release" }, // filled triangle
  live: { ch: "■", color: "#0E8F7E", label: "Live" }, // filled square
  end: { ch: "■", color: "#0E8F7E", label: "Card ends" },
};
const mark = (k: Kind, size = "9pt"): string =>
  '<span style="color:' +
  SYM[k].color +
  ";font-weight:bold;font-size:" +
  size +
  ';line-height:1">' +
  SYM[k].ch +
  "</span>";
const markLabel = (k: Kind): string =>
  mark(k) +
  ' <span style="font-weight:bold;color:' +
  SYM[k].color +
  '">' +
  SYM[k].label +
  "</span>";

const legend = (): string =>
  T_PLAIN +
  '<tr><td style="' +
  S.small +
  ';border:0;padding:1pt 0">' +
  markLabel("rec") +
  " &nbsp;recording date &nbsp;&nbsp;|&nbsp;&nbsp; " +
  markLabel("rel") +
  " &nbsp;release date (goes live) &nbsp;&nbsp;|&nbsp;&nbsp; " +
  markLabel("end") +
  " &nbsp;card end date (drops off the platform)" +
  "</td></tr></table>";

/* A card runs from its release date through its card end date; with no card end
   date the run is open-ended. Used for the table column and for deciding which
   cards belong to a month — not for painting individual days. */
const liveTill = (it: DocItem): string =>
  !it.relDate ? "—" : it.cardEnd ? fmtShort(it.cardEnd) : "Ongoing";
function liveInMonth(it: DocItem, ym: string): boolean {
  if (!it.relDate) return false;
  if (it.relDate > dayStr(ym, ymDays(ym))) return false;
  if (it.cardEnd && it.cardEnd < dayStr(ym, 1)) return false;
  return true;
}

interface Card {
  idx: number;
  it: DocItem;
}

export function calCards(f: DocData, ym: string): Card[] {
  const out: Card[] = [];
  f.items.forEach((it, i) => {
    if (
      inMonth(it.relDate, ym) ||
      inMonth(it.recDate, ym) ||
      liveInMonth(it, ym)
    )
      out.push({ idx: i + 1, it });
  });
  out.sort((a, b) => {
    const x = a.it.relDate || a.it.recDate || "9999";
    const y = b.it.relDate || b.it.recDate || "9999";
    return x < y ? -1 : x > y ? 1 : 0;
  });
  return out;
}

/** Derived pipeline stage — richer than the raw status, as in the legacy tool. */
export function stageOf(it: DocItem): string {
  if (it.status === "Cancelled") return "Cancelled";
  if (it.status === "Done") return "Done";
  const today = toLocalISO(new Date());
  if (it.cardEnd && it.cardEnd < today) return "Ended";
  if (it.relDate && it.relDate <= today) return "Live";
  if (it.recDate && it.recDate <= today) return "Recorded — in post";
  if (it.recDate || it.relDate) return "To record";
  return "Unscheduled";
}
export const STAGES = [
  "To record",
  "Recorded — in post",
  "Live",
  "Done",
  "Ended",
  "Cancelled",
  "Unscheduled",
];

/* ---------------------------------------------------------------- table */
const CAL_COLS = 12;
const CAL_HEAD =
  "<tr>" +
  th("#", "width:3%") +
  th("Topic name", "width:13%") +
  th("Content category", "width:12%") +
  th("Card type", "width:8%") +
  th(SYM.rec.ch + " Recording", "width:9%;" + S.c) +
  th(SYM.rel.ch + " Release", "width:9%;" + S.c) +
  th(SYM.live.ch + " Live till", "width:9%;" + S.c) +
  th("Produced by", "width:8%") +
  th("Streamed as", "width:9%") +
  th("Promotion type", "width:7%") +
  th("Status", "width:7%;" + S.c) +
  th("Proposal", "width:6%;" + S.c) +
  "</tr>";

function proposeCell(f: DocData, it: DocItem): string {
  if (f.forWord) return tdC("—");
  // Proposing is a commercial act — it sends a rate to a partner — so a barter
  // project that has not opted into commercials offers no button, exactly as
  // the Word export does not.
  if (f.partnerType === "Barter" && !f.barterCommercials) return tdC("—");
  return tdC(
    '<button type="button" class="pbtn" style="' +
      S.pbtn +
      '" data-prop="' +
      esc(it.id) +
      '">Propose</button>',
  );
}

function calRow(f: DocData, c: Card): string {
  const it = c.it,
    tp = topicOf(it);
  return (
    "<tr>" +
    tdC(String(c.idx)) +
    td("<b>" + (tp ? esc(tp) : it.projDesc ? esc(it.projDesc) : "—") + "</b>") +
    td(esc(it.name)) +
    td(na(it.cardType)) +
    tdC((it.recDate ? mark("rec", "8pt") + " " : "") + fmtShort(it.recDate)) +
    tdC((it.relDate ? mark("rel", "8pt") + " " : "") + fmtShort(it.relDate)) +
    tdC((it.relDate ? mark("live", "8pt") + " " : "") + liveTill(it)) +
    td(na(it.produced)) +
    td(na(it.stream)) +
    td(na(it.promo)) +
    tdC(esc(it.status)) +
    proposeCell(f, it) +
    "</tr>"
  );
}

function buildKanban(f: DocData, cards: Card[]): string {
  let body = "";
  for (const st of STAGES) {
    const group = cards.filter((c) => stageOf(c.it) === st);
    if (!group.length) continue;
    body +=
      '<tr><td colspan="' +
      CAL_COLS +
      '" style="' +
      S.td +
      ";" +
      S.totTd +
      '">' +
      esc(st) +
      " &nbsp;·&nbsp; " +
      group.length +
      " card" +
      (group.length > 1 ? "s" : "") +
      "</td></tr>" +
      group.map((c) => calRow(f, c)).join("");
  }
  if (!body)
    body =
      '<tr><td colspan="' +
      CAL_COLS +
      '" style="' +
      S.td +
      ";" +
      S.c +
      '">No cards scheduled in this month.</td></tr>';
  return legend() + T_CAL + CAL_HEAD + body + "</table>";
}

function buildGrid(f: DocData, ym: string, cards: Card[]): string {
  const y = parseInt(ym.slice(0, 4), 10),
    m = parseInt(ym.slice(5, 7), 10) - 1;
  const lead = new Date(y, m, 1).getDay(),
    days = ymDays(ym);

  const byDay: Record<number, { c: Card; kind: Kind }[]> = {};
  const push = (d: number, e: { c: Card; kind: Kind }) => {
    (byDay[d] ||= []).push(e);
  };
  // Only days where something actually happens. A card that is merely still
  // live is deliberately not drawn: a single 90-day card would otherwise fill
  // three months of cells and make an empty calendar look fully booked. Its
  // run is still on the page, in the "Live till" column of the table below.
  for (const c of cards) {
    if (inMonth(c.it.recDate, ym))
      push(parseInt(c.it.recDate.slice(8, 10), 10), { c, kind: "rec" });
    if (inMonth(c.it.relDate, ym))
      push(parseInt(c.it.relDate.slice(8, 10), 10), { c, kind: "rel" });
    if (inMonth(c.it.cardEnd, ym))
      push(parseInt(c.it.cardEnd.slice(8, 10), 10), { c, kind: "end" });
  }

  let out =
    '<table border="1" bordercolor="#A9B4C4" cellspacing="0" cellpadding="4" width="100%" ' +
    'style="border-collapse:collapse;width:100%;margin:0 0 10pt;table-layout:fixed"><tr>' +
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
      .map((d) => th(d, "width:14%;" + S.c))
      .join("") +
    "</tr>";

  let cell = 0,
    day = 1;
  while (day <= days) {
    out += "<tr>";
    for (let col = 0; col < 7; col++, cell++) {
      if (cell < lead || day > days) {
        out += '<td width="14%" style="width:14%;' + S.td + '">&nbsp;</td>';
        continue;
      }
      const list = byDay[day] || [];
      let inner =
        '<div style="font-weight:bold;font-size:8.5pt;color:#203760">' +
        day +
        "</div>";

      for (const e of list) {
        const it = e.c.it,
          tp = topicOf(it);
        inner +=
          '<div style="margin-top:3pt;font-size:6.5pt;line-height:1.3;color:#202936;' +
          "word-wrap:break-word;border-left:2pt solid " +
          SYM[e.kind].color +
          ';padding-left:3pt">' +
          mark(e.kind, "8pt") +
          " <b>" +
          esc(SYM[e.kind].label) +
          "</b>" +
          "<br><b>" +
          (tp ? esc(tp) : esc(it.name)) +
          "</b>" +
          "<br>" +
          esc(it.name) +
          "<br>" +
          na(it.cardType) +
          " · " +
          na(it.produced) +
          "<br>" +
          na(it.stream) +
          " · " +
          na(it.promo) +
          "<br>Status: " +
          esc(it.status) +
          "</div>";
      }

      out +=
        '<td width="14%" style="width:14%;height:60pt;vertical-align:top;' +
        S.td +
        '">' +
        inner +
        "</td>";
      day++;
    }
    out += "</tr>";
  }
  out += "</table>" + legend();

  return (
    out +
    sect("All cards this month") +
    T_CAL +
    CAL_HEAD +
    (cards.length
      ? cards.map((c) => calRow(f, c)).join("")
      : '<tr><td colspan="' +
        CAL_COLS +
        '" style="' +
        S.td +
        ";" +
        S.c +
        '">No cards scheduled in this month.</td></tr>') +
    "</table>"
  );
}

/** Legacy buildCalendar(): kanban-by-stage or a real month grid, both with the marker legend. */
export function buildCalendar(f: DocData): string {
  const ym = calMonthValue(f);
  const view = f.calView ?? "kanban";
  const cards = calCards(f, ym);
  const label =
    MONFULL[parseInt(ym.slice(5, 7), 10) - 1] + " " + ym.slice(0, 4);
  const unscheduled = f.items.filter((it) => !it.relDate && !it.recDate).length;

  const body =
    letterhead(
      f,
      "CONTENT CALENDAR",
      esc(label) +
        " &nbsp;·&nbsp; " +
        (view === "kanban" ? "Kanban view" : "Calendar view"),
    ) +
    partyBlock(f, "Client", [
      ["Project", PROJ(f)],
      ["Month", esc(label)],
      ["View", view === "kanban" ? "Kanban" : "Calendar"],
      ["Cards this month", String(cards.length)],
      ["Partner type", or(f.partnerType)],
      ["Linked estimate no.", or(f.estNo)],
      ["Generated on", esc(toLocalISO(new Date()))],
    ]) +
    sect(esc(label)) +
    (view === "kanban" ? buildKanban(f, cards) : buildGrid(f, ym, cards)) +
    (f.forWord
      ? stampRow(
          "The Propose button is available on screen in the tool; it cannot be clicked in a Word file.",
        )
      : "") +
    (unscheduled
      ? stampRow(
          unscheduled +
            " card" +
            (unscheduled > 1 ? "s have" : " has") +
            " no recording or release date yet, so " +
            (unscheduled > 1 ? "they do" : "it does") +
            " not appear above.",
        )
      : "");

  return docShell("Content calendar", body, f.forWord);
}
