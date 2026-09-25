import { DocData, fmtDate, shiftDays } from "./_reexport";
import { reminderRows } from "./kickoff";

const icsDate = (s: string): string => s.replace(/-/g, "");
const icsEsc = (s: string): string => String(s ?? "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");

/** RFC 5545 line folding at 75 octets. */
function icsFold(line: string): string {
  if (line.length <= 74) return line;
  let out = line.slice(0, 74), rest = line.slice(74);
  while (rest.length) { out += "\r\n " + rest.slice(0, 73); rest = rest.slice(73); }
  return out;
}

const safe = (s: string, n = 40): string =>
  String(s || "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, n);

/**
 * One all-day VEVENT per END date (card / video / branding / project / contract),
 * spanning the 2 days before through the date itself, with a DISPLAY alarm on
 * each of those three days — exactly the legacy tool's reminder rule.
 */
export function buildICS(f: DocData): string {
  const notify = f.coEmail || "admin@onference.in";
  const rem = reminderRows(f);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const L: string[] = [
    "BEGIN:VCALENDAR", "VERSION:2.0",
    "PRODID:-//Onference TV//Kick Off Reminders//EN",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
  ];

  rem.forEach((r, i) => {
    const start = shiftDays(r.date, -2), end = shiftDays(r.date, 1);
    if (!start || !end) return;
    const title = r.label + " - " + (f.projName || "Onference TV project");
    L.push("BEGIN:VEVENT");
    L.push("UID:onf-" + safe(f.estNo || "est", 24) + "-" + i + "@onference.tv");
    L.push("DTSTAMP:" + stamp);
    L.push("DTSTART;VALUE=DATE:" + icsDate(start));
    L.push("DTEND;VALUE=DATE:" + icsDate(end));
    L.push("SUMMARY:" + icsEsc(title));
    L.push("DESCRIPTION:" + icsEsc(
      "Project: " + (f.projName || "—") + "\nClient: " + (f.cName || "—")
      + "\nCard: " + r.card + "\nMilestone: " + r.label + " on " + fmtDate(r.date)
      + "\nReminder runs daily from 2 days prior until the date itself."
      + "\nNotify: " + notify));
    L.push("ORGANIZER;CN=Onference TV:mailto:" + notify);
    L.push("ATTENDEE;CN=Onference Admin;RSVP=FALSE:mailto:" + notify);
    for (const d of [-2, -1, 0]) {
      L.push("BEGIN:VALARM");
      L.push("ACTION:DISPLAY");
      L.push("TRIGGER;VALUE=DATE-TIME:" + icsDate(shiftDays(r.date, d)) + "T090000Z");
      L.push("DESCRIPTION:" + icsEsc(title + " - " + fmtDate(r.date)));
      L.push("END:VALARM");
    }
    L.push("END:VEVENT");
  });

  L.push("END:VCALENDAR");
  return L.map(icsFold).join("\r\n") + "\r\n";
}

export { safe };
