/**
 * Pure helpers shared by the picker and the service — no database import, so
 * the browser can use them without dragging mongoose into the bundle.
 */

/** What the caller decided a changed contact name means. */
export interface ContactIntent {
  /** "update" corrects the person already on record; "new" is a handover. */
  mode: "update" | "new";
  /** Which directory row to correct. Omitted means "the current one". */
  contactId?: string;
}

export function normName(v: unknown): string {
  return String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** The person without their job title: "B. Shetty, GM Marketing" → "b. shetty". */
export function personPart(v: unknown): string {
  return normName(String(v ?? "").split(",")[0]);
}

/** Levenshtein. Names are short, so the simple one-row version is plenty. */
function distance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length || !b.length) return Math.max(a.length, b.length);
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = row;
  }
  return prev[b.length];
}

/**
 * Are these two spellings the same human?
 *
 * A promotion ("GM Marketing" → "VP Marketing") and a typo are both the same
 * person with a different string, which is exactly what name-matching alone got
 * wrong. This only ever *suggests* an answer — whoever is saving sees the
 * choice spelled out and can flip it.
 */
export function sameHuman(a: unknown, b: unknown): boolean {
  const A = normName(a);
  const B = normName(b);
  if (!A || !B) return false;
  if (A === B) return true;
  // same name, different job title
  const pa = personPart(a);
  if (pa && pa === personPart(b)) return true;
  // same string, a slip of the keyboard
  const limit = Math.max(1, Math.floor(Math.min(A.length, B.length) / 8));
  return distance(A, B) <= limit;
}
