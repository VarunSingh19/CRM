import { money, num, toWords } from "@/lib/money";
import {
  DocData, docShell, letterhead, partyBlock, scopeTable, signatures, totalsBlock,
  sect, stampRow, esc, nl2br, fmtDate, or, na, secShort, topicOf, PROJ,
  T_DATA, T_PLAIN, th, td, tdC, tdR, S,
} from "./_reexport";

/** Legacy buildInvoice(): 9-column billing lines with SAC, remit-to totals, scope reference. */
export function buildInvoice(f: DocData): string {
  const t = f.totals;
  const invNo = f.estNo ? f.estNo.replace("/EST/", "/INV-REQ/") : "—";
  const dot = " · ";

  const rows = f.items.map((it, i) => {
    const tp = topicOf(it);
    return "<tr>" + tdC(String(i + 1))
      + td("<b>" + esc(it.name) + '</b><br><span style="' + S.small + '">' + esc(secShort(it.section)) + dot + na(it.cardType)
        + (tp ? dot + "Topic: " + esc(tp) : "")
        + (it.projDesc ? dot + esc(it.projDesc) : "") + "</span>")
      + tdC(or(f.sac)) + tdC(or(it.duration)) + tdC(String(it.qty))
      + tdR(money(num(it.rate))) + tdR(money(it.gross ?? 0))
      + tdR(it.disc ? "-" + money(it.disc) : "—")
      + tdR("<b>" + money(it.net ?? 0) + "</b>")
      + "</tr>";
  }).join("");

  const billing = T_DATA
    + "<tr>" + th("#", "width:3%") + th("Description", "width:30%")
    + th("SAC", "width:9%;" + S.c) + th("Duration", "width:9%;" + S.c) + th("Qty", "width:6%;" + S.c)
    + th("Rate", "width:11%;" + S.r) + th("Amount", "width:11%;" + S.r)
    + th("Discount", "width:10%;" + S.r) + th("Net", "width:11%;" + S.r) + "</tr>"
    + rows + "</table>";

  const remit = '<div style="' + S.lbl + ';margin-bottom:3pt">Remit to</div>'
    + '<div style="' + S.small + '">'
      + (f.coBank ? nl2br(f.coBank) : "Bank details to be filled in by finance") + "</div>"
    + '<div style="' + S.small + ';margin-top:6pt"><b>Amount in words:</b> ' + esc(toWords(t.total)) + "</div>";

  const body = letterhead(f, "INVOICE REQUEST", "For finance — raise a tax invoice on the client per the details below", true)
    + partyBlock(f, "Bill to", [
      ["Project", PROJ(f)],
      ["Request no.", esc(invNo)], ["Linked estimate no.", or(f.estNo)],
      ["Date", fmtDate(f.date)], ["Partner type", or(f.partnerType)],
      ["Place of supply", or(f.pos)],
      ["Client PO / reference", or(f.cPo)],
      ["GST treatment", f.gstMode === "inter" ? "IGST 18% (inter-state)" : "CGST 9% + SGST 9% (intra-state)"],
    ])
    + sect("Billing lines")
    + billing
    + totalsBlock(f, t, remit)
    + sect("Scope reference")
    + scopeTable(f)
    + sect("Terms")
    + T_PLAIN + '<tr><td style="' + S.small + ';border:0;padding:1pt 0">'
      + (f.terms ? nl2br(f.terms) : "—") + "</td></tr></table>"
    + stampRow("Finance: please verify client GSTIN, place of supply and SAC before raising the tax invoice. "
      + "This document is an internal request and is not itself a tax invoice.")
    + signatures([{ label: "Requested by" }, { label: "Finance approval" }], 18);

  return docShell("Invoice request " + (f.estNo || ""), body, f.forWord);
}
