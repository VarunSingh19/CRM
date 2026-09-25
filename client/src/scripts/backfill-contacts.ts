/**
 * Seeds the contact directory from the contact/email/mobile already stored on
 * each partner, so the picker is useful from the first day instead of starting
 * empty. Safe to re-run: recordContact matches on name within the partner and
 * updates rather than duplicating.
 *
 * Run:  npx tsx src/scripts/backfill-contacts.ts
 */

import fs from "node:fs";
import path from "node:path";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const p = path.join(process.cwd(), file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      let v = m[2].trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      )
        v = v.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  }
}
loadEnv();

async function main() {
  const mongoose = (await import("mongoose")).default;
  const { connectDB } = await import("../lib/db");
  const { Partner } = await import("../features/partners/partner.model");
  const { Contact } = await import("../features/contacts/contact.model");
  const { recordContact } =
    await import("../features/contacts/contact.service");

  await connectDB();

  const partners = (await Partner.find({}).lean()) as any[];
  let filed = 0;
  let skipped = 0;

  for (const p of partners) {
    if (!String(p.contact ?? "").trim()) {
      skipped++;
      continue;
    }
    await recordContact(
      String(p._id),
      p,
      p.ownerId ? String(p.ownerId) : undefined,
    );
    filed++;
  }

  const total = await Contact.countDocuments();
  console.log(`Partners scanned:        ${partners.length}`);
  console.log(`Contacts filed:          ${filed}`);
  console.log(`Skipped (no contact):    ${skipped}`);
  console.log(`Contacts in directory:   ${total}`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
