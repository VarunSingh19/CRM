/**
 * Demo seed — a realistic book of business for showing the product.
 *
 *   npm run seed:demo            add the demo dataset
 *   npm run seed:demo -- --reset remove it first, then re-add
 *   npm run seed:demo -- --clear remove it and stop
 *
 * Safe to run against a database that already has real work in it: only records
 * whose names appear in demo-data.ts are ever touched. Dates are generated
 * relative to the day you run it, so the dashboard and calendar always look
 * current — a demo seeded in March still shows live cards in December.
 */
import fs from "node:fs";
import path from "node:path";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const fp = path.join(process.cwd(), file);
    if (!fs.existsSync(fp)) continue;
    for (const line of fs.readFileSync(fp, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  }
}
loadEnv();

const args = process.argv.slice(2);
const RESET = args.includes("--reset");
const CLEAR_ONLY = args.includes("--clear");
const DEMO_PASSWORD = "Demo@2026";

/** Deterministic PRNG, so every run produces the same dataset. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const iso = (d: Date): string =>
  d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

function shift(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return iso(d);
}
const shiftFrom = (base: string, days: number): string => {
  const d = new Date(base + "T00:00:00");
  d.setDate(d.getDate() + days);
  return iso(d);
};

type Phase = "delivered" | "active" | "upcoming";

/** Where a project sits in its lifecycle drives every date and status below. */
const PHASE_WINDOW: Record<Phase, { start: [number, number]; length: [number, number] }> = {
  delivered: { start: [-165, -115], length: [55, 80] },
  // starts far enough back that roughly half of an active project's cards have
  // already gone live — otherwise every board column reads "to record"
  active: { start: [-78, -34], length: [85, 125] },
  upcoming: { start: [10, 38], length: [65, 100] },
};

async function main() {
  const bcrypt = (await import("bcryptjs")).default;
  const mongoose = (await import("mongoose")).default;
  const { connectDB } = await import("../lib/db");
  const { User } = await import("../features/users/user.model");
  const { Project } = await import("../features/projects/project.model");
  const { LineItem } = await import("../features/line-items/line-item.model");
  const { Partner } = await import("../features/partners/partner.model");
  const { Offering } = await import("../features/catalog/offering.model");
  const { EstimateSequence } = await import("../features/projects/estimate-sequence.model");
  const { getSettings } = await import("../features/settings/settings.service");
  const { fyOf } = await import("../lib/defaults");
  const { PARTNERS, PROJECTS, RATE_CARD, TEAM } = await import("./demo-data");

  await connectDB();

  const partnerNames = PARTNERS.map((x) => x.name);
  const projectNames = PROJECTS.map((x) => x.name);

  /* ------------------------------------------------------------- clear */
  if (RESET || CLEAR_ONLY) {
    const doomed = await Project.find({ projName: { $in: projectNames } }, { _id: 1 }).lean();
    const ids = doomed.map((d) => d._id);
    const items = await LineItem.deleteMany({ projectId: { $in: ids } });
    await Project.deleteMany({ _id: { $in: ids } });
    const parts = await Partner.deleteMany({ name: { $in: partnerNames } });
    await User.deleteMany({ username: { $in: TEAM.map((t) => t.username) } });
    console.log(`  cleared: ${ids.length} projects, ${items.deletedCount ?? 0} content items, ${parts.deletedCount ?? 0} partners, ${TEAM.length} demo team accounts`);
    if (CLEAR_ONLY) {
      await mongoose.disconnect();
      console.log("\nDemo data removed. Your own records were not touched.");
      process.exit(0);
    }
  }

  /* ------------------------------------------------------------- guard */
  const clash = await Project.countDocuments({ projName: { $in: projectNames } });
  if (clash > 0) {
    console.error(`\n  ${clash} demo project(s) already exist. Re-run with --reset to rebuild them.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const offerings = await Offering.find({ active: true }).lean();
  if (!offerings.length) {
    console.error("\n  The offerings catalog is empty. Run `npm run seed` first.");
    await mongoose.disconnect();
    process.exit(1);
  }
  const offeringOf = new Map(offerings.map((o) => [o.name as string, o]));

  /* ------------------------------------------------------------- team */
  const owners = new Map<string, string>();
  for (const u of ["admin", "sales"]) {
    const found = await User.findOne({ username: u }, { _id: 1 }).lean() as { _id: unknown } | null;
    if (found) owners.set(u, String(found._id));
  }
  if (!owners.has("admin")) {
    console.error("\n  No admin user found. Run `npm run seed` first.");
    await mongoose.disconnect();
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  for (const t of TEAM) {
    const existing = await User.findOne({ username: t.username }, { _id: 1 }).lean() as { _id: unknown } | null;
    if (existing) {
      owners.set(t.username, String(existing._id));
    } else {
      const created = await User.create({ ...t, passwordHash, active: true });
      owners.set(t.username, String(created._id));
    }
  }
  console.log(`  team: ${TEAM.length} demo accounts ready (password ${DEMO_PASSWORD})`);

  /* ------------------------------------------------------------- partners */
  const adminId = owners.get("admin")!;
  const salesIds = ["sales", "priya", "rahul"].map((u) => owners.get(u)).filter(Boolean) as string[];

  const partnerDocs = await Partner.insertMany(
    PARTNERS.map((x, i) => ({
      name: x.name, type: x.type, contact: x.contact, email: x.email,
      mobile: x.mobile, gstin: x.gstin, addr: x.addr,
      ownerId: salesIds.length ? salesIds[i % salesIds.length] : adminId,
      archived: false,
    }))
  );
  const partnerId = new Map(partnerDocs.map((d) => [d.name as string, String(d._id)]));
  console.log(`  partners: ${partnerDocs.length} created`);

  /* ------------------------------------------------------------- projects */
  const settings = await getSettings();
  const entity = {
    coName: settings.coName, coGstin: settings.coGstin, coLlpin: settings.coLlpin,
    coPan: settings.coPan, coTan: settings.coTan, coMsme: settings.coMsme, coAddr: settings.coAddr,
    coEmail: settings.coEmail, coSite: settings.coSite, coBank: settings.coBank,
  };

  // Continue the real numbering rather than inventing one. A --reset frees the
  // numbers it deletes, so rebase the counter on what is actually still in use
  // before reserving a block — otherwise every rebuild drifts further ahead.
  const fy = fyOf(shift(0));
  const prefix = `ONF/EST/${fy}/`;
  const inUse = await Project.find({}, { estNo: 1 }).lean();
  const highest = inUse.reduce((max, row) => {
    const no = String(row.estNo ?? "");
    if (!no.startsWith(prefix)) return max;
    const n = parseInt(no.slice(prefix.length), 10);
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);
  await EstimateSequence.updateOne(
    { key: fy }, { $set: { seq: highest } }, { upsert: true });

  const seqRow = await EstimateSequence.findOneAndUpdate(
    { key: fy }, { $inc: { seq: PROJECTS.length } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean() as unknown as { seq: number };
  let nextNo = (seqRow?.seq ?? PROJECTS.length) - PROJECTS.length;

  const rand = rng(20260830);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
  const between = ([lo, hi]: [number, number]): number => lo + Math.floor(rand() * (hi - lo + 1));

  let itemTotal = 0;
  let overdueSeeded = 0;
  const statusTally: Record<string, number> = {};

  for (const spec of PROJECTS) {
    const partner = PARTNERS[spec.partner];
    const win = PHASE_WINDOW[spec.phase];
    const koStart = shift(between(win.start));
    const koEnd = shiftFrom(koStart, between(win.length));
    const docDate = shiftFrom(koStart, -between([6, 20]));

    nextNo += 1;
    const estNo = `ONF/EST/${fy}/${String(nextNo).padStart(4, "0")}`;

    // a barter arrangement carries no document-level discount; volume deals do
    const discPct = partner.type === "Barter" ? 0 : pick([0, 0, 0, 5, 7.5, 10]);

    const project = await Project.create({
      projName: spec.name,
      partnerType: partner.type,
      partnerId: partnerId.get(partner.name),
      cName: partner.name, cContact: partner.contact, cEmail: partner.email,
      cMobile: partner.mobile, cAddr: partner.addr, cGstin: partner.gstin,
      date: docDate, estNo, validity: settings.defaultValidity || "15",
      pos: spec.pos,
      cPo: rand() > 0.55 ? `PO-${2026}${String(between([1000, 9999]))}` : "",
      // place of supply outside Maharashtra means an inter-state supply
      gstMode: spec.pos === "Maharashtra" ? "intra" : "inter",
      sac: settings.defaultSac || "998365",
      terms: settings.defaultTerms || "",
      docDiscType: "percent", docDiscValue: discPct,
      koStart, koEnd,
      koContract: shiftFrom(koEnd, between([10, 25])),
      koOwner: pick(["A. Sharma", "P. Nair", "R. Mehta", "S. Iyer", "V. Kulkarni"]),
      koProducer: pick(["K. Rao", "A. Pillai", "M. Dsouza", "T. Bhatt"]),
      koNotes: spec.notes,
      entity,
      ownerId: owners.get(spec.owner) ?? adminId,
      archived: false,
    });

    /* ----------------------------------------------------------- content */
    const items: Record<string, unknown>[] = [];
    const span = Math.max(1, spec.mix.length);

    spec.mix.forEach((offeringName, i) => {
      const o = offeringOf.get(offeringName);
      if (!o) return;

      // spread releases evenly across the project window
      const lengthDays = Math.round(
        (new Date(koEnd + "T00:00:00").getTime() - new Date(koStart + "T00:00:00").getTime()) / 86400000
      );
      const step = Math.max(7, Math.floor(lengthDays / (span + 1)));
      const relDate = shiftFrom(koStart, step * (i + 1));
      const recDate = shiftFrom(relDate, -between([7, 14]));

      // end dates follow the offering's own duration
      const liveDays = o.duration === "90 Days" ? 90 : o.duration === "1 Month" ? 30 : 3;
      const cardEnd = shiftFrom(relDate, liveDays);
      const videoEnd = shiftFrom(relDate, liveDays + between([20, 40]));
      const brandEnd = shiftFrom(relDate, liveDays + between([45, 75]));

      const today = shift(0);
      let status: string;
      if (spec.phase === "delivered") {
        status = rand() > 0.9 ? "Cancelled" : "Done";
      } else if (spec.phase === "upcoming") {
        status = "Planner";
      } else if (relDate <= today) {
        // live or already wrapped
        status = cardEnd < today ? (rand() > 0.35 ? "Done" : "In Progress") : "In Progress";
      } else {
        status = recDate <= today ? "In Progress" : "Planner";
      }

      // leave a few genuinely overdue milestones so the dashboard has teeth
      let vEnd = videoEnd;
      if (spec.phase === "active" && status === "In Progress" && overdueSeeded < 4 && rand() > 0.72) {
        vEnd = shift(-between([2, 9]));
        overdueSeeded += 1;
      }

      statusTally[status] = (statusTally[status] ?? 0) + 1;

      const base = RATE_CARD[offeringName] ?? 50000;
      // small negotiated variance, rounded to a sane invoice figure
      const rate = Math.round((base * (0.9 + rand() * 0.25)) / 500) * 500;
      const qty = o.section === "Daily Pulse" ? between([1, 4]) : between([1, 2]);
      const lineDisc = rand() > 0.78 ? pick([5, 10]) : 0;

      items.push({
        projectId: project._id,
        section: o.section, name: o.name,
        topic: o.section === "Media Services" ? "" : (spec.topics[i] ?? spec.topics[0] ?? ""),
        projDesc: o.section === "Media Services" ? (spec.topics[i] ?? "") : "",
        status,
        cardType: (o.cardTypes as string[])[0] ?? "",
        promo: (o.promo as string[])[0] ?? "",
        stream: (o.stream as string[])[0] ?? "",
        produced: (o.produced as string[])[0] ?? "",
        incl: o.incl, excl: o.excl, dev: o.dev, duration: o.duration,
        qty, rate, amountOverride: "",
        discType: "percent", discValue: lineDisc,
        cardName: `${spec.name.split(" ")[0]} · Card ${i + 1}`,
        recDate, relDate, cardEnd, videoEnd: vEnd, brandEnd,
        sortOrder: i,
      });
    });

    if (items.length) {
      await LineItem.insertMany(items);
      itemTotal += items.length;
    }
  }

  console.log(`  projects: ${PROJECTS.length} created (${itemTotal} content items)`);
  console.log(`  statuses: ${Object.entries(statusTally).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(", ")}`);
  console.log(`  overdue milestones seeded: ${overdueSeeded}`);
  console.log(`  estimate numbers: ONF/EST/${fy}/${String(nextNo - PROJECTS.length + 1).padStart(4, "0")} … ${String(nextNo).padStart(4, "0")}`);

  await mongoose.disconnect();
  console.log("\nDemo data ready. Sign in as admin, sales, priya or rahul to see different books of business.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
