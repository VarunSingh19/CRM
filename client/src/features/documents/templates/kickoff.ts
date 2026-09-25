import { num } from "@/lib/money";
import {
  DocData, DocItem, docShell, letterhead, partyBlock, scopeTable, signatures,
  sect, stampRow, esc, nl2br, fmtDate, shiftDays, or, na, secShort, topicOf, PROJ,
  T_DATA, T_PLAIN, th, td, tdC, S,
} from "./_reexport";

export const END_FIELDS: [keyof DocItem, string][] = [
  ["cardEnd", "Card end"], ["videoEnd", "Video end"], ["brandEnd", "Branding end"],
];

export interface ReminderRow { label: string; date: string; card: string; idx: string }

/** Every end date across the project, sorted — drives both the table and the .ics. */
export function reminderRows(f: DocData): ReminderRow[] {
  const out: ReminderRow[] = [];
  f.items.forEach((it, i) => {
    for (const [key, label] of END_FIELDS) {
      const date = it[key] as string;
      if (date) out.push({ label, date, card: it.cardName || topicOf(it) || it.name, idx: String(i + 1) });
    }
  });
  if (f.koContract) out.push({ label: "Contract end", date: f.koContract, card: "Project-wide", idx: "—" });
  if (f.koEnd) out.push({ label: "Project end", date: f.koEnd, card: "Project-wide", idx: "—" });
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out;
}

/** Legacy buildKickoff(): deliverables, kick-off inputs, scope, reminders, notes, sign-offs. */
export function buildKickoff(f: DocData): string {
  const koNo = f.estNo ? f.estNo.replace("/EST/", "/KO/") : "—";

  const deliverables = f.items.map((it, i) =>
    "<tr>" + tdC(String(i + 1)) + td(esc(secShort(it.section)))
    + td("<b>" + esc(it.name) + "</b>")
    + td(na(it.cardType)) + td(na(it.promo)) + td(na(it.stream))
    + td(na(it.produced)) + tdC(esc(it.status))
    + tdC(or(it.duration)) + tdC(String(it.qty))
    + "</tr>").join("");
  const qty = f.items.reduce((a, it) => a + num(it.qty), 0);

  const sched = f.items.map((it, i) => {
    const t = topicOf(it);
    return "<tr>" + tdC(String(i + 1))
      + td(t ? esc(t) : it.projDesc ? esc(it.projDesc) : "—")
      + td(esc(it.name))
      + td(na(it.cardType))
      + td(or(it.cardName))
      + tdC(esc(it.status))
      + tdC(fmtDate(it.recDate))
      + tdC(fmtDate(it.relDate))
      + tdC(fmtDate(it.cardEnd))
      + tdC(fmtDate(it.videoEnd))
      + tdC(fmtDate(it.brandEnd))
      + "</tr>";
  }).join("");

  const rem = reminderRows(f);
  const remTable = rem.length
    ? T_DATA
      + "<tr>" + th("#", "width:6%") + th("Card", "width:30%") + th("Milestone", "width:20%")
      + th("Date", "width:14%;" + S.c) + th("Reminder window", "width:30%;" + S.c) + "</tr>"
      + rem.map((r) =>
        "<tr>" + tdC(r.idx) + td(esc(r.card)) + td(esc(r.label))
        + tdC(fmtDate(r.date))
        + tdC(fmtDate(shiftDays(r.date, -2)) + " to " + fmtDate(r.date) + ", daily")
        + "</tr>").join("")
      + "</table>"
    : T_PLAIN + '<tr><td style="' + S.small + ';border:0;padding:1pt 0">'
      + "No end dates entered yet — no reminders to schedule.</td></tr></table>";

  const body = letterhead(f, "KICK OFF", "Delivery scope and schedule — not for circulation outside Onference")
    + partyBlock(f, "Client", [
      ["Project", PROJ(f)],
      ["Kick off no.", esc(koNo)], ["Linked estimate no.", or(f.estNo)],
      ["Date", fmtDate(f.date)], ["Partner type", or(f.partnerType)],
      ["Project start", fmtDate(f.koStart)], ["Project end", fmtDate(f.koEnd)],
      ["Contract end", fmtDate(f.koContract)],
      ["Account owner", or(f.koOwner)], ["Production owner", or(f.koProducer)],
    ])
    + sect("Deliverables")
    + T_DATA
      + "<tr>" + th("#", "width:4%") + th("Media section", "width:11%") + th("Content category", "width:18%")
      + th("Card type", "width:12%") + th("Promotion", "width:10%") + th("Streamed as", "width:13%")
      + th("Produced by", "width:11%") + th("Status", "width:9%;" + S.c)
      + th("Duration", "width:8%;" + S.c) + th("Qty", "width:4%;" + S.c) + "</tr>"
      + deliverables
      + '<tr><td colspan="9" style="' + S.td + ";" + S.r + ";" + S.totTd + '">Total units to deliver</td>'
      + '<td style="' + S.td + ";" + S.c + ";" + S.totTd + '">' + qty + "</td></tr>"
    + "</table>"
    + sect("Inputs for kick off")
    + T_DATA
      + "<tr>" + th("#", "width:4%") + th("Topic name", "width:15%") + th("Content category", "width:15%")
      + th("Card type", "width:10%") + th("Card name", "width:13%")
      + th("Status", "width:8%;" + S.c)
      + th("Recording", "width:7%;" + S.c) + th("Release", "width:7%;" + S.c)
      + th("Card end", "width:7%;" + S.c) + th("Video end", "width:7%;" + S.c)
      + th("Branding end", "width:7%;" + S.c) + "</tr>"
      + sched
    + "</table>"
    + sect("Scope — inclusions, exclusions &amp; deviations")
    + scopeTable(f)
    + sect("Reminder schedule")
    + remTable
    + stampRow("Reminders trigger 2 days prior to each end date and repeat daily until the date itself, "
      + "by email to " + or(f.coEmail, "admin@onference.in") + ", quoting the project name.")
    + sect("Kick off internal notes")
    + T_PLAIN + '<tr><td style="' + S.small + ';border:0;padding:1pt 0">'
      + (f.koNotes ? nl2br(f.koNotes) : "—") + "</td></tr></table>"
    + stampRow("Commercial terms are deliberately omitted from this document. "
      + "Rate, amount, discount, tax and total are held on the estimate and the invoice request only.")
    + signatures([
      { label: "Raised by" }, { label: "Production sign-off" }, { label: "Approved by" },
    ]);

  return docShell("Kick off", body, f.forWord);
}
