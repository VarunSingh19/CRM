import { money, GST_RATE, type Totals } from "@/lib/money";
import { TBD, hasTopic, secShort as secShortOf } from "@/lib/defaults";

export interface DocItem {
  id: string;
  name: string;
  section: string;
  topic: string;
  projDesc: string;
  status: string;
  cardType: string;
  promo: string;
  stream: string;
  produced: string;
  incl: string;
  excl: string;
  dev: string;
  duration: string;
  qty: number;
  rate: number;
  amountOverride: number | "" | null;
  discType: "amount" | "percent";
  discValue: number;
  cardName: string;
  recDate: string;
  relDate: string;
  cardEnd: string;
  videoEnd: string;
  brandEnd: string;
  net?: number;
  gross?: number;
  disc?: number;
}

export interface DocData {
  projName: string;
  partnerType: string;
  /** Barter projects only show commercials when this is set. */
  barterCommercials: boolean;
  cName: string;
  cContact: string;
  cEmail: string;
  cMobile: string;
  cAddr: string;
  cGstin: string;
  date: string;
  estNo: string;
  validity: string;
  pos: string;
  cPo: string;
  gstMode: "intra" | "inter";
  sac: string;
  terms: string;
  docDiscType: "amount" | "percent";
  docDiscValue: number;
  koStart: string;
  koEnd: string;
  koContract: string;
  koOwner: string;
  koProducer: string;
  koNotes: string;
  coName: string;
  coGstin: string;
  coLlpin: string;
  coPan: string;
  coTan: string;
  coMsme: string;
  coAddr: string;
  coEmail: string;
  coSite: string;
  coBank: string;
  items: DocItem[];
  totals: Totals;
  /** true when rendering for a .doc download (hides interactive Propose buttons). */
  forWord?: boolean;
  /** true for a single-item proposal — suppresses the document-level discount row. */
  isProposal?: boolean;
  /** calendar only */
  calView?: "kanban" | "calendar";
  calMonth?: string;
}

/* ---------------------------------------------------------------- escaping */
export const esc = (s: unknown): string =>
  String(s ?? "").replace(
    /[&<>"]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string,
  );
export const nl2br = (s: unknown): string => esc(s).replace(/\n/g, "<br>");
export const or = (s: unknown, fb = "—"): string =>
  String(s ?? "").trim() ? esc(s) : fb;
export const na = (s: unknown): string =>
  String(s ?? "").trim() ? esc(s) : "Not Applicable";

/* ---------------------------------------------------------------- dates */
export const MON = [
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
];
export const MONFULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Local-midnight parse, so a yyyy-mm-dd never slips a day across time zones. */
export function parseISO(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s + "T00:00:00");
  return isNaN(+d) ? null : d;
}
export function toLocalISO(d: Date): string {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}
export const fmtDate = (s: string): string => {
  const d = parseISO(s);
  if (!d) return "—";
  return (
    String(d.getDate()).padStart(2, "0") +
    " " +
    MON[d.getMonth()] +
    " " +
    d.getFullYear()
  );
};
export const fmtShort = (s: string): string => {
  const d = parseISO(s);
  if (!d) return "—";
  return String(d.getDate()).padStart(2, "0") + " " + MON[d.getMonth()];
};
export function shiftDays(s: string, n: number): string {
  const d = parseISO(s);
  if (!d) return "";
  d.setDate(d.getDate() + n);
  return toLocalISO(d);
}
export const addDays = (s: string, n: string | number): string => {
  const r = shiftDays(s, Number(n) || 0);
  return r ? fmtDate(r) : "—";
};

export const secShort = secShortOf;

/** Legacy topicOf(): DP/EMA carry a topic (blank prints "To Be Decided"); Media Services carries none. */
export const topicOf = (it: { section: string; topic?: string }): string =>
  hasTopic(it.section) ? (it.topic || "").trim() || TBD : "";

/* ---------------------------------------------------------------- inline styles
   Word ignores most class-based CSS, so every rule is emitted inline too.
   Palette is the original tool's: navy #203760, orange #F47C22, blue, teal. */
export const S = {
  docttl: "font-size:17pt;font-weight:bold;color:#203760;margin:0",
  docsub: "font-size:8.5pt;color:#63718A;margin:2pt 0 0",
  co: "font-size:12pt;font-weight:bold;color:#203760",
  lbl: "font-size:7.5pt;color:#63718A;text-transform:uppercase;font-weight:bold",
  rule: "border-top:2pt solid #F47C22;font-size:1pt;line-height:1pt;margin:6pt 0 10pt",
  sect: "font-size:9pt;font-weight:bold;color:#203760;background:#EDF1F6;padding:4pt 6pt;border-left:3pt solid #F47C22;margin:12pt 0 6pt",
  small: "font-size:8pt;color:#63718A;line-height:1.4",
  stamp: "border:1pt solid #A9B4C4;padding:6pt;font-size:8pt;color:#63718A",
  r: "text-align:right",
  c: "text-align:center",
  th: "background:#203760;color:#FFFFFF;text-align:left;font-size:8pt;font-weight:bold;padding:4pt 5pt;border:0.5pt solid #A9B4C4;vertical-align:top",
  td: "border:0.5pt solid #A9B4C4;padding:4pt 5pt;vertical-align:top;font-size:8.5pt",
  totTd: "background:#EDF1F6;font-weight:bold",
  grandTd: "background:#203760;color:#FFFFFF;font-weight:bold;font-size:10pt",
  pbtn: "background:#0E8F7E;color:#FFFFFF;border:0;border-radius:4px;padding:4pt 9pt;font-size:8pt;font-weight:bold;cursor:pointer;font-family:Arial,Helvetica,sans-serif",
  plainTd: "border:0;padding:1pt 0;font-size:9pt",
};

export const T_DATA =
  '<table border="1" bordercolor="#A9B4C4" cellspacing="0" cellpadding="4" width="100%" style="border-collapse:collapse;width:100%;margin:0 0 10pt">';
export const T_CAL =
  '<table border="1" bordercolor="#A9B4C4" cellspacing="0" cellpadding="3" width="100%" style="border-collapse:collapse;width:100%;margin:0 0 10pt;table-layout:fixed">';
export const T_PLAIN =
  '<table border="0" cellspacing="0" cellpadding="0" width="100%" style="border-collapse:collapse;width:100%;margin:0 0 6pt">';
export const T_PLAIN_MT = (pt: number): string =>
  '<table border="0" cellspacing="0" cellpadding="0" width="100%" style="border-collapse:collapse;width:100%;margin-top:' +
  pt +
  'pt;margin-bottom:6pt">';

export const sect = (t: string): string =>
  '<div style="' + S.sect + '">' + t + "</div>";
export const small = (t: string): string =>
  '<div style="' + S.small + '">' + t + "</div>";
export const stampRow = (t: string): string =>
  T_PLAIN + '<tr><td style="' + S.stamp + '">' + t + "</td></tr></table>";

/** <th>/<td> builders that carry their own inline styling. */
export const th = (label: string, extra = ""): string =>
  '<th style="' + S.th + ";" + extra + '">' + label + "</th>";
export const td = (html: string, extra = ""): string =>
  '<td style="' + S.td + ";" + extra + '">' + html + "</td>";
export const tdC = (html: string, extra = ""): string =>
  td(html, S.c + ";white-space:nowrap;" + extra);
export const tdR = (html: string, extra = ""): string =>
  td(html, S.r + ";white-space:nowrap;" + extra);

/* ---------------------------------------------------------------- shell */
const DOC_CSS =
  "body{font-family:Arial,Helvetica,sans-serif;font-size:9.5pt;color:#202936;margin:0}" +
  "table{border-collapse:collapse;width:100%;margin:0 0 10pt}" +
  "td,th{border:0.5pt solid #A9B4C4;padding:4pt 5pt;vertical-align:top;font-size:8.5pt}" +
  "th{background:#203760;color:#FFFFFF;text-align:left;font-size:8pt}" +
  ".r{text-align:right}.c{text-align:center}";

/** Relays a Propose click from the preview iframe up to the editor. */
const PROPOSE_SCRIPT =
  "<script>" +
  'document.addEventListener("click",function(e){' +
  'var b=e.target.closest&&e.target.closest("[data-prop]");' +
  "if(!b)return;e.preventDefault();" +
  'parent.postMessage({onfPropose:b.getAttribute("data-prop")},"*");' +
  "});" +
  "<" +
  "/script>";

/**
 * Wraps a document body for either a Word download (MSO landscape WordSection1)
 * or an on-screen preview (A4 landscape print rules on a page-like sheet).
 */
export function docShell(title: string, body: string, forWord = false): string {
  const page = forWord
    ? "@page WordSection1{size:29.7cm 21.0cm;mso-page-orientation:landscape;margin:1.1cm;}div.WordSection1{page:WordSection1;}"
    : "@page{size:A4 landscape;margin:1.1cm}body{background:#E9EDF3;padding:20px}" +
      ".WordSection1{background:#fff;max-width:1080px;margin:0 auto;padding:26px;box-shadow:0 2px 14px rgba(0,0,0,.12)}" +
      "@media print{body{background:#fff;padding:0}.WordSection1{box-shadow:none;max-width:none;padding:0}.pbtn{display:none}}";

  return (
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" ' +
    'xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>' +
    esc(title) +
    "</title>" +
    "<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->" +
    "<style>" +
    DOC_CSS +
    page +
    "</style></head>" +
    '<body style="font-family:Arial,Helvetica,sans-serif;font-size:8.5pt;color:#202936">' +
    '<div class="WordSection1" style="font-family:Arial,Helvetica,sans-serif;font-size:8.5pt;color:#202936">' +
    body +
    "</div>" +
    (forWord ? "" : PROPOSE_SCRIPT) +
    "</body></html>"
  );
}

/* ---------------------------------------------------------------- blocks */
export const PROJ = (f: DocData): string =>
  f.projName ? "<b>" + esc(f.projName) + "</b>" : "—";

export function letterhead(
  f: DocData,
  title: string,
  subtitle: string,
  // MSME/Udyam is a client-facing commercial identifier — only the Estimate
  // and Invoice request pass this; Kick-off and the Content calendar don't.
  includeMsme = false,
): string {
  const ids: string[] = [];
  if (f.coLlpin) ids.push("LLPIN: " + esc(f.coLlpin));
  if (f.coPan) ids.push("PAN: " + esc(f.coPan));
  if (f.coTan) ids.push("TAN: " + esc(f.coTan));
  if (includeMsme && f.coMsme) ids.push("MSME: " + esc(f.coMsme));
  if (f.coGstin) ids.push("GST: " + esc(f.coGstin));
  const contact: string[] = [];
  if (f.coEmail) contact.push(esc(f.coEmail));
  if (f.coSite) contact.push(esc(f.coSite));
  const sep = " &nbsp;|&nbsp; ";
  return (
    T_PLAIN +
    "<tr>" +
    '<td width="58%" style="width:58%;' +
    S.plainTd +
    '"><div style="' +
    S.co +
    '">' +
    or(f.coName) +
    "</div>" +
    '<div style="' +
    S.small +
    ';margin-top:3pt">' +
    ids.join(sep) +
    "</div>" +
    '<div style="' +
    S.small +
    '">' +
    (f.coAddr ? nl2br(f.coAddr) : "") +
    "</div>" +
    '<div style="' +
    S.small +
    '">' +
    contact.join(sep) +
    "</div></td>" +
    '<td width="42%" style="width:42%;' +
    S.plainTd +
    ";" +
    S.r +
    '"><div style="' +
    S.docttl +
    '">' +
    title +
    "</div>" +
    '<div style="' +
    S.docsub +
    '">' +
    subtitle +
    "</div></td>" +
    '</tr></table><div style="' +
    S.rule +
    '"></div>'
  );
}

export function partyBlock(
  f: DocData,
  partyLabel: string,
  rows: [string, string][],
): string {
  const left =
    '<td width="50%" style="width:50%;' +
    S.td +
    '" rowspan="' +
    rows.length +
    '">' +
    '<div style="' +
    S.lbl +
    ';margin-bottom:3pt">' +
    partyLabel +
    "</div>" +
    '<div style="font-size:10.5pt;font-weight:bold">' +
    or(f.cName) +
    "</div>" +
    (f.cContact
      ? '<div style="' + S.small + '">Attn: ' + esc(f.cContact) + "</div>"
      : "") +
    '<div style="' +
    S.small +
    ';margin-top:3pt">' +
    (f.cAddr ? nl2br(f.cAddr) : "—") +
    "</div>" +
    '<div style="' +
    S.small +
    ';margin-top:3pt">' +
    or(f.cEmail) +
    " &nbsp;|&nbsp; " +
    or(f.cMobile) +
    "</div>" +
    (f.cGstin
      ? '<div style="' + S.small + '">GSTIN: ' + esc(f.cGstin) + "</div>"
      : "") +
    "</td>";
  let out = T_DATA;
  rows.forEach((r, i) => {
    out +=
      "<tr>" +
      (i === 0 ? left : "") +
      '<td width="21%" style="width:21%;' +
      S.td +
      ";" +
      S.lbl +
      '">' +
      r[0] +
      "</td>" +
      '<td width="29%" style="width:29%;' +
      S.td +
      '">' +
      r[1] +
      "</td></tr>";
  });
  return out + "</table>";
}

export function scopeTable(f: DocData): string {
  return (
    T_DATA +
    "<tr>" +
    th("#", "width:4%") +
    th("Offering", "width:22%") +
    th("Inclusion", "width:25%") +
    th("Exclusion", "width:33%") +
    th("Deviations", "width:16%") +
    "</tr>" +
    f.items
      .map((it, i) => {
        const t = topicOf(it);
        return (
          "<tr>" +
          tdC(String(i + 1)) +
          td(
            "<b>" +
              esc(it.name) +
              '</b><br><span style="' +
              S.small +
              '">' +
              esc(secShort(it.section)) +
              (t ? "<br>Topic: " + esc(t) : "") +
              (it.projDesc ? "<br>" + esc(it.projDesc) : "") +
              "</span>",
          ) +
          td(it.incl ? nl2br(it.incl) : "—") +
          td(it.excl ? nl2br(it.excl) : "—") +
          td(it.dev ? nl2br(it.dev) : "—") +
          "</tr>"
        );
      })
      .join("") +
    "</table>"
  );
}

export function specLine(it: DocItem): string {
  const t = topicOf(it);
  const dot = " · ";
  return (
    '<span style="' +
    S.small +
    '">' +
    esc(secShort(it.section)) +
    dot +
    na(it.cardType) +
    (t ? "<br>Topic: " + esc(t) : "") +
    (it.projDesc ? "<br>" + esc(it.projDesc) : "") +
    "<br>Promotion: " +
    na(it.promo) +
    dot +
    "Streamed as: " +
    na(it.stream) +
    "<br>Produced by: " +
    na(it.produced) +
    dot +
    "Status: " +
    esc(it.status) +
    "</span>"
  );
}

export function totalsBlock(f: DocData, t: Totals, leftHtml: string): string {
  const half = GST_RATE / 2;
  const rows: [string, string, string][] = [
    ["Sub-total", money(t.sub), S.totTd],
  ];
  if (!f.isProposal) {
    rows.push([
      "Discount" +
        (f.docDiscType === "percent" && f.docDiscValue
          ? " (" + f.docDiscValue + "%)"
          : ""),
      t.docDisc ? "-" + money(t.docDisc) : "—",
      "",
    ]);
  }
  rows.push(["Taxable value", money(t.taxable), S.totTd]);
  if (f.gstMode === "inter")
    rows.push(["IGST @ " + GST_RATE + "%", money(t.igst), ""]);
  else {
    rows.push(["CGST @ " + half + "%", money(t.cgst), ""]);
    rows.push(["SGST @ " + half + "%", money(t.sgst), ""]);
  }
  rows.push(["Grand total", money(t.total), S.grandTd]);

  const left =
    '<td width="52%" style="width:52%;' +
    S.td +
    '" rowspan="' +
    rows.length +
    '">' +
    leftHtml +
    "</td>";
  let out = T_DATA;
  rows.forEach((r, i) => {
    out +=
      "<tr>" +
      (i === 0 ? left : "") +
      '<td width="28%" style="width:28%;' +
      S.td +
      ";" +
      S.r +
      ";" +
      r[2] +
      '">' +
      r[0] +
      "</td>" +
      '<td width="20%" style="width:20%;' +
      S.td +
      ";" +
      S.r +
      ";white-space:nowrap;" +
      r[2] +
      '">' +
      r[1] +
      "</td></tr>";
  });
  return out + "</table>";
}

/** Signature strip — each column gets a label and a blank ruled space. */
export function signatures(
  cols: { label: string; hint?: string }[],
  marginTop = 20,
): string {
  const w = Math.floor(100 / cols.length);
  return (
    T_PLAIN_MT(marginTop) +
    "<tr>" +
    cols
      .map((c, i) => {
        const width = i === cols.length - 1 ? 100 - w * (cols.length - 1) : w;
        return (
          '<td style="width:' +
          width +
          '%;border:0;padding:1pt 0">' +
          '<div style="' +
          S.lbl +
          '">' +
          esc(c.label) +
          "</div>" +
          '<div style="height:34pt;line-height:34pt;font-size:34pt">&nbsp;</div>' +
          (c.hint
            ? '<div style="' + S.small + '">' + esc(c.hint) + "</div>"
            : "") +
          "</td>"
        );
      })
      .join("") +
    "</tr></table>"
  );
}
