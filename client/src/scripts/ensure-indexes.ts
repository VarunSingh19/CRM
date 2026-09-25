/**
 * Build the indexes declared on the schemas. Mongoose autoIndex is off in
 * production, so this runs them explicitly.
 * Run:  npx tsx src/scripts/ensure-indexes.ts
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
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  }
}
loadEnv();

async function main() {
  const { connectDB } = await import("../lib/db");
  const mongoose = (await import("mongoose")).default;

  const models = [
    ["Project", (await import("../features/projects/project.model")).Project],
    ["LineItem", (await import("../features/line-items/line-item.model")).LineItem],
    ["Partner", (await import("../features/partners/partner.model")).Partner],
    ["Contact", (await import("../features/contacts/contact.model")).Contact],
    ["Offering", (await import("../features/catalog/offering.model")).Offering],
    ["User", (await import("../features/users/user.model")).User],
    ["AuditLog", (await import("../features/audit/audit-log.model")).AuditLog],
    ["EstimateSequence", (await import("../features/projects/estimate-sequence.model")).EstimateSequence],
    ["Settings", (await import("../features/settings/settings.model")).Settings],
  ] as const;

  await connectDB();

  // Email became a sign-in credential, so it now carries a unique index. If the
  // data already holds duplicates the build fails with a bare E11000 naming one
  // pair; name them all up front instead, since fixing them is the actual task.
  {
    const { User } = await import("../features/users/user.model");
    const dupes = await User.aggregate([
      { $match: { email: { $gt: "" } } },
      { $group: { _id: "$email", n: { $sum: 1 }, who: { $push: "$username" } } },
      { $match: { n: { $gt: 1 } } },
    ]);
    if (dupes.length) {
      console.error("");
      console.error("Duplicate emails block the unique index on User.email:");
      console.error("");
      for (const d of dupes) console.error(`  ${d._id}  ->  ${d.who.join(", ")}`);
      console.error("");
      console.error("Give each account its own email (or clear the spares), then re-run.");
      process.exit(1);
    }
  }

  for (const [name, model] of models) {
    await model.createIndexes();
    const list = await model.collection.indexes();
    console.log(`  ${name.padEnd(17)} ${list.map((i) => i.name).join(", ")}`);
  }
  await mongoose.disconnect();
  console.log("\nIndexes ensured.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
