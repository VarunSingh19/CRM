/**
 * Prefilled values, ported verbatim from the original single-file tool.
 * These are the values the legacy form shipped hard-coded in its markup:
 * section 4 (Tax, terms & company details) and the "Valid for (days)" box.
 */

/** Issuing entity — legacy section 4 "Issuing entity" inputs. */
export const COMPANY_DEFAULTS = {
  coName: "Onference Training Technologies LLP",
  coGstin: "27AAEFO9993N1Z7",
  coLlpin: "AAG-8842",
  coPan: "AAEFO9993N",
  coTan: "MUMO07434A",
  coMsme: "",
  coAddr: "G-18, HiLife Mall, PM Road, Santacruz (W), Mumbai – 400054",
  coEmail: "admin@onference.in",
  coSite: "www.onference.tv",
  coBank: "",
} as const;

/** Legacy #terms textarea content. */
export const DEFAULT_TERMS =
  "100% advance against this estimate. Content go-live begins only after receipt of payment " +
  "and final creative approval. Rates are exclusive of GST. This estimate is valid for the " +
  "period stated above and is subject to slot availability at the time of confirmation.";

/** Legacy #sac input value. */
export const DEFAULT_SAC = "998365";

/** Legacy #validity input value. */
export const DEFAULT_VALIDITY = "15";

/** Legacy: blank topic prints this on every document. */
export const TBD = "To Be Decided";

export const SEC_DP = "Daily Pulse";
export const SEC_EMA = "Exclusive Members Access (EMA)";
export const SEC_MS = "Media Services";
export const SECTIONS = [SEC_DP, SEC_EMA, SEC_MS];

/** Daily Pulse + EMA carry a topic name; Media Services carries a project description. */
export const hasTopic = (section: string): boolean =>
  section === SEC_DP || section === SEC_EMA;
export const isMS = (section: string): boolean => section === SEC_MS;
export const secShort = (section: string): string =>
  section === SEC_EMA ? "EMA" : section;
export const secKey = (section: string): "dp" | "ema" | "ms" =>
  section === SEC_DP ? "dp" : section === SEC_EMA ? "ema" : "ms";

/** Legacy topicOf(): topic only for DP/EMA, falling back to "To Be Decided". */
export function topicOf(it: { section: string; topic?: string }): string {
  return hasTopic(it.section) ? (it.topic || "").trim() || TBD : "";
}

export const STATUSES = [
  "Planner",
  "In Progress",
  "Done",
  "Cancelled",
] as const;
export const PARTNER_TYPES = ["Receivable", "Payable", "Barter"] as const;

/** Indian financial year label for a yyyy-mm-dd string, e.g. 2026-08-29 -> "2026-27". */
export function fyOf(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr + "T00:00:00") : new Date();
  const base = isNaN(+d) ? new Date() : d;
  const y = base.getFullYear();
  const start = base.getMonth() >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/** Local (not UTC) yyyy-mm-dd — matches the legacy toLocalISO(). */
export function toLocalISO(d: Date = new Date()): string {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}
