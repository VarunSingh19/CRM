/**
 * Seed the database with the original tool's users + catalog.
 * Run:  npm run seed   (reads MONGODB_URI from .env.local)
 */
import fs from "node:fs";
import path from "node:path";

// --- load .env.local before anything imports db.ts (which reads env at load) ---
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
  const bcrypt = (await import("bcryptjs")).default;
  const { connectDB } = await import("../lib/db");
  const { User } = await import("../features/users/user.model");
  const { Offering } = await import("../features/catalog/offering.model");
  const { Settings } = await import("../features/settings/settings.model");
  const { CATALOG } = await import("../lib/catalog-seed-data");
  const { COMPANY_DEFAULTS, DEFAULT_TERMS, DEFAULT_SAC, DEFAULT_VALIDITY } = await import("../lib/defaults");

  await connectDB();

  const users = [
    { username: "admin", name: "Admin", role: "admin", password: "Onference@2026" },
    { username: "sales", name: "Sales", role: "sales", password: "Sales@2026" },
    { username: "ops", name: "Ops", role: "ops", password: "Ops@2026" },
  ];
  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    const existing = await User.findOne({ username: u.username }).lean();
    await User.updateOne(
      { username: u.username },
      // re-running the seed must never reset a password someone has since changed
      { $set: { name: u.name, role: u.role, active: true }, $setOnInsert: { passwordHash } },
      { upsert: true }
    );
    console.log(existing
      ? `  user: ${u.username} (${u.role}) — kept existing password`
      : `  user: ${u.username} / ${u.password}  (${u.role})`);
  }

  // The catalog is admin-editable in the app, so a re-run must not clobber those
  // edits: content is written on insert only; ordering is kept in sync.
  let n = 0, added = 0;
  for (const o of CATALOG) {
    const res = await Offering.updateOne(
      { name: o.name },
      { $setOnInsert: { ...o, active: true }, $set: { sortOrder: n } },
      { upsert: true }
    );
    if (res.upsertedCount) added++;
    n++;
  }
  console.log(`  catalog: ${n} offerings (${added} newly added, ${n - added} left as-is)`);

  const wanted: Record<string, string> = {
    ...COMPANY_DEFAULTS,
    defaultTerms: DEFAULT_TERMS,
    defaultSac: DEFAULT_SAC,
    defaultValidity: DEFAULT_VALIDITY,
  };
  const current = (await Settings.findOne({ key: "company" }).lean()) as Record<string, unknown> | null;
  if (!current) {
    await Settings.create({ key: "company", ...wanted });
    console.log("  settings: created with company prefills");
  } else {
    // backfill only what is still blank — never overwrite a value an admin has entered
    const fill: Record<string, string> = {};
    for (const [k, v] of Object.entries(wanted)) {
      if (!v) continue;
      const now = current[k];
      if (now === undefined || now === null || String(now).trim() === "") fill[k] = v;
    }
    if (Object.keys(fill).length) {
      await Settings.updateOne({ key: "company" }, { $set: fill });
      console.log("  settings: backfilled " + Object.keys(fill).join(", "));
    } else {
      console.log("  settings: already populated, nothing to backfill");
    }
  }

  console.log("\nSeed complete.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
