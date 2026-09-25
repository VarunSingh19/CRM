/**
 * Money + calc helpers, ported faithfully from the original single-file tool
 * (num, money, calcLine, totals) so generated documents keep identical numbers.
 */
export const GST_RATE = 18;

export function num(v: unknown): number {
  const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? 0 : n;
}

export function money(n: number): string {
  const x = Math.round(n * 100) / 100;
  return (
    "₹" +
    x.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export type DiscType = "amount" | "percent";
export type GstMode = "intra" | "inter";

export interface LineCalcInput {
  qty: number;
  rate: number;
  discType: DiscType;
  discValue: number;
  amountOverride?: number | "" | null;
}

export interface LineCalc {
  gross: number;
  disc: number;
  net: number;
  qty: number;
  rate: number;
}

export function calcLine(it: LineCalcInput): LineCalc {
  const q = num(it.qty),
    r = num(it.rate),
    dt = it.discType,
    dv = num(it.discValue);
  const ov = it.amountOverride;
  const gross = ov !== "" && ov !== null && ov !== undefined ? num(ov) : q * r;
  let disc = dt === "percent" ? (gross * dv) / 100 : dv;
  if (disc > gross) disc = gross;
  if (disc < 0) disc = 0;
  return { gross, disc, net: gross - disc, qty: q, rate: r };
}

export interface TotalsInput {
  items: LineCalcInput[];
  docDiscType: DiscType;
  docDiscValue: number;
  gstMode: GstMode;
}

export interface Totals {
  gross: number;
  lineDisc: number;
  sub: number;
  docDisc: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

export function totals(input: TotalsInput): Totals {
  let gross = 0,
    lineDisc = 0;
  for (const it of input.items) {
    const c = calcLine(it);
    gross += c.gross;
    lineDisc += c.disc;
  }
  const sub = gross - lineDisc;
  let docDisc =
    input.docDiscType === "percent"
      ? (sub * num(input.docDiscValue)) / 100
      : num(input.docDiscValue);
  if (docDisc > sub) docDisc = sub;
  if (docDisc < 0) docDisc = 0;
  const taxable = sub - docDisc;
  let cgst = 0,
    sgst = 0,
    igst = 0;
  if (input.gstMode === "inter") igst = (taxable * GST_RATE) / 100;
  else {
    cgst = (taxable * GST_RATE) / 200;
    sgst = cgst;
  }
  return {
    gross,
    lineDisc,
    sub,
    docDisc,
    taxable,
    cgst,
    sgst,
    igst,
    total: taxable + cgst + sgst + igst,
  };
}

/** Number to Indian-English words — ported 1:1 from the legacy tool's words().
 *  Returns e.g. "Rupees One Lakh Twenty Thousand and Fifty Paise Only". */
export function toWords(n: number): string {
  n = Math.round(n * 100) / 100;
  if (n === 0) return "Rupees Zero Only";
  const a = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const b = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];
  const two = (x: number): string =>
    x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? " " + a[x % 10] : "");
  const three = (x: number): string =>
    x >= 100
      ? a[Math.floor(x / 100)] +
        " Hundred" +
        (x % 100 ? " " + two(x % 100) : "")
      : two(x);

  let rs = Math.floor(n);
  const ps = Math.round((n - rs) * 100);
  let out = "";
  const cr = Math.floor(rs / 10000000);
  rs %= 10000000;
  const lk = Math.floor(rs / 100000);
  rs %= 100000;
  const th = Math.floor(rs / 1000);
  rs %= 1000;
  if (cr) out += three(cr) + " Crore ";
  if (lk) out += three(lk) + " Lakh ";
  if (th) out += three(th) + " Thousand ";
  if (rs) out += three(rs);
  out = ("Rupees " + out).trim().replace(/\s+/g, " ");
  if (ps) out += " and " + two(ps) + " Paise";
  return out + " Only";
}
