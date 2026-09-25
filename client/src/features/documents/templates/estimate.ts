import { money, num, toWords } from "@/lib/money";
import {
  DocData, docShell, letterhead, partyBlock, scopeTable, specLine, totalsBlock,
  signatures, sect, esc, nl2br, fmtDate, addDays, or, PROJ,
  T_DATA, T_PLAIN, th, td, tdC, tdR, S,
} from "./_reexport";

/** Legacy buildEstimate(): 8-column commercial summary, totals, scope, terms, signatures. */
export function buildEstimate(f: DocData): string {
  const t = f.totals;

  const rows = f.items.map((it, i) =>
    "<tr>" + tdC(String(i + 1))
    + td("<b>" + esc(it.name) + "</b><br>" + specLine(it))
    + tdC(or(it.duration))
    + tdC(String(it.qty))
    + tdR(money(num(it.rate)))
    + tdR(money(it.gross ?? 0))
    + tdR(it.disc ? "-" + money(it.disc) : "—")
    + tdR("<b>" + money(it.net ?? 0) + "</b>")
    + "</tr>").join("");

  const commercials = T_DATA
    + "<tr>" + th("#", "width:3%") + th("Offering &amp; specification", "width:34%")
    + th("Duration", "width:9%;" + S.c) + th("Qty", "width:6%;" + S.c)
    + th("Rate", "width:12%;" + S.r) + th("Amount", "width:12%;" + S.r)
    + th("Discount", "width:11%;" + S.r) + th("Net", "width:13%;" + S.r) + "</tr>"
    + rows + "</table>";

  const wordsBlock = '<div style="' + S.lbl + ';margin-bottom:3pt">Amount in words</div>'
    + '<div style="' + S.small + '">' + esc(toWords(t.total)) + "</div>"
    + '<div style="' + S.small + ';margin-top:6pt">All figures in Indian Rupees. Rates are exclusive of GST.</div>';

  const body = letterhead(f, "ESTIMATE",
      f.isProposal ? "Proposal for selected content" : "Quotation for Onference TV media &amp; content offerings",
      true)
    + partyBlock(f, "Estimate for", [
      ["Project", PROJ(f)],
      ["Estimate no.", or(f.estNo)], ["Date", fmtDate(f.date)],
      ["Valid till", addDays(f.date, f.validity)], ["Partner type", or(f.partnerType)],
      ["Place of supply", or(f.pos)],
      ["Client reference", or(f.cPo)], ["SAC", or(f.sac)],
    ])
    + sect("Commercial summary")
    + commercials
    + totalsBlock(f, t, wordsBlock)
    + sect("Scope — inclusions, exclusions &amp; deviations")
    + scopeTable(f)
    + sect("Terms &amp; conditions")
    + T_PLAIN + '<tr><td style="' + S.small + ';border:0;padding:1pt 0">'
      + (f.terms ? nl2br(f.terms) : "—") + "</td></tr></table>"
    + signatures([
      { label: "For " + (f.coName || "Onference"), hint: "Authorised signatory" },
      { label: "Accepted for " + (f.cName || "Client"), hint: "Name, designation, date & sign" },
    ], 22);

  return docShell("Estimate " + (f.estNo || ""), body, f.forWord);
}
