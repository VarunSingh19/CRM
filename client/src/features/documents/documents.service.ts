import { connectDB } from "@/lib/db";
import { Project } from "@/features/projects/project.model";
import { LineItem } from "@/features/line-items/line-item.model";
import { GeneratedDocument } from "./generated-document.model";
import { Proposal } from "@/features/proposals/proposal.model";
import { totals as computeTotals, calcLine, num } from "@/lib/money";
import { ForbiddenError, type Role } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";
import { writeAudit } from "@/features/audit/audit.service";
import { DocData, DocItem } from "./templates/shared";
import { buildEstimate } from "./templates/estimate";
import { buildKickoff } from "./templates/kickoff";
import { buildInvoice } from "./templates/invoice";
import { buildCalendar } from "./templates/calendar";
import { buildICS } from "./templates/ics";

export type DocType = "estimate" | "kickoff" | "invoice" | "calendar";

/** Which roles may generate which document. Ops = production docs only (commercial-blind). */
const DOC_PERMISSIONS: Record<DocType, Role[]> = {
  estimate: ["admin", "sales"],
  invoice: ["admin", "sales"],
  calendar: ["admin", "sales", "ops"],
  kickoff: ["admin", "sales", "ops"],
};

export function canGenerate(role: Role, type: DocType): boolean {
  return DOC_PERMISSIONS[type].includes(role);
}

export interface ProposalOverride {
  qty?: number; rate?: number; discType?: "amount" | "percent"; discValue?: number;
}

export interface ProposalInput {
  lineItemId: string;
  gstMode?: "intra" | "inter";
  partner?: Partial<Record<"name" | "type" | "email" | "mobile" | "contact" | "gstin" | "addr", string>>;
  override?: ProposalOverride;
}

export interface BuildOptions {
  forWord?: boolean;
  calView?: "kanban" | "calendar";
  calMonth?: string;
  /** single-item proposal overlay */
  proposal?: ProposalInput;
}

function toDocItem(it: Record<string, any>, override?: ProposalOverride): DocItem {
  const qty = override?.qty !== undefined ? num(override.qty) : (it.qty as number);
  const rate = override?.rate !== undefined ? num(override.rate) : (it.rate as number);
  const discType = (override?.discType ?? it.discType) as "amount" | "percent";
  const discValue = override?.discValue !== undefined ? num(override.discValue) : (it.discValue as number);
  // an override replaces the stored amount entirely, as in the legacy proposal flow
  const amountOverride = override ? "" : (it.amountOverride as number | "");

  const c = calcLine({ qty, rate, discType, discValue, amountOverride });
  return {
    id: String(it._id),
    name: it.name as string, section: it.section as string, topic: (it.topic as string) || "",
    projDesc: (it.projDesc as string) || "", status: it.status as string,
    cardType: (it.cardType as string) || "", promo: (it.promo as string) || "",
    stream: (it.stream as string) || "", produced: (it.produced as string) || "",
    incl: (it.incl as string) || "", excl: (it.excl as string) || "", dev: (it.dev as string) || "",
    duration: (it.duration as string) || "",
    qty, rate, amountOverride, discType, discValue,
    cardName: (it.cardName as string) || "", recDate: (it.recDate as string) || "",
    relDate: (it.relDate as string) || "", cardEnd: (it.cardEnd as string) || "",
    videoEnd: (it.videoEnd as string) || "", brandEnd: (it.brandEnd as string) || "",
    net: c.net, gross: c.gross, disc: c.disc,
  };
}

export async function buildDocData(projectId: string, opts: BuildOptions = {}): Promise<DocData> {
  await connectDB();
  const p = await Project.findById(projectId).lean() as any;
  if (!p) throw new Error("Project not found");

  const prop = opts.proposal;
  const query = prop ? { projectId, _id: prop.lineItemId } : { projectId };
  const rawItems = await LineItem.find(query).sort({ sortOrder: 1, createdAt: 1 }).lean();
  if (prop && !rawItems.length) throw new Error("That line item is no longer on this project.");

  const items: DocItem[] = rawItems.map((it) => toDocItem(it as Record<string, any>, prop?.override));

  // a proposal quotes only its own line, with no document-level discount
  const docDiscType = prop ? "amount" : (p.docDiscType as "amount" | "percent");
  const docDiscValue = prop ? 0 : (p.docDiscValue as number);
  const gstMode = (prop?.gstMode ?? p.gstMode) as "intra" | "inter";

  const t = computeTotals({
    items: items.map((i) => ({
      qty: i.qty, rate: i.rate, discType: i.discType, discValue: i.discValue, amountOverride: i.amountOverride,
    })),
    docDiscType, docDiscValue, gstMode,
  });

  const e = p.entity ?? {};
  const pt = prop?.partner;
  const shortId = prop ? String(prop.lineItemId).slice(-6) : "";

  return {
    projName: p.projName as string,
    partnerType: (pt?.type || p.partnerType) as string,
    barterCommercials: !!p.barterCommercials,
    cName: (pt?.name ?? p.cName) as string, cContact: (pt?.contact ?? p.cContact) as string,
    cEmail: (pt?.email ?? p.cEmail) as string, cMobile: (pt?.mobile ?? p.cMobile) as string,
    cAddr: (pt?.addr ?? p.cAddr) as string, cGstin: (pt?.gstin ?? p.cGstin) as string,
    date: p.date as string,
    estNo: prop ? (String(p.estNo || "ONF/EST") + "-P" + shortId) : (p.estNo as string),
    validity: p.validity as string, pos: p.pos as string, cPo: p.cPo as string,
    gstMode, sac: p.sac as string, terms: p.terms as string,
    docDiscType, docDiscValue,
    koStart: p.koStart as string, koEnd: p.koEnd as string, koContract: p.koContract as string,
    koOwner: p.koOwner as string, koProducer: p.koProducer as string, koNotes: p.koNotes as string,
    coName: (e.coName as string) ?? "", coGstin: (e.coGstin as string) ?? "", coLlpin: (e.coLlpin as string) ?? "",
    coPan: (e.coPan as string) ?? "", coTan: (e.coTan as string) ?? "", coMsme: (e.coMsme as string) ?? "",
    coAddr: (e.coAddr as string) ?? "",
    coEmail: (e.coEmail as string) ?? "", coSite: (e.coSite as string) ?? "", coBank: (e.coBank as string) ?? "",
    items, totals: t,
    forWord: !!opts.forWord,
    isProposal: !!prop,
    calView: opts.calView, calMonth: opts.calMonth,
  };
}

function render(type: DocType, data: DocData): string {
  return type === "estimate" ? buildEstimate(data)
    : type === "kickoff" ? buildKickoff(data)
    : type === "invoice" ? buildInvoice(data)
    : buildCalendar(data);
}

const slug = (s: string): string => (s || "project").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

/**
 * `mode: "preview"` renders in-app HTML (Propose buttons live, no audit row);
 * `mode: "word"` renders the MSO landscape .doc and records the generation.
 */
export async function generateDocument(
  user: CurrentUser, projectId: string, type: DocType,
  opts: BuildOptions & { mode?: "preview" | "word" } = {}
) {
  if (!canGenerate(user.role, type)) {
    throw new ForbiddenError(`Your role cannot generate a ${type} document.`);
  }
  const mode = opts.mode ?? "word";
  const forWord = mode === "word";
  const data = await buildDocData(projectId, { ...opts, forWord });
  const html = render(type, data);

  if (forWord) {
    await GeneratedDocument.create({
      projectId, type, number: data.estNo,
      snapshot: { total: data.totals.total, itemCount: data.items.length },
      generatedBy: user.id,
    });
    await writeAudit(user, `document.${type}`, "document", projectId, {
      projectId,
      label: `Generated ${type} ${data.estNo || ""} for “${data.projName}”`.trim(),
      meta: { type, number: data.estNo, total: data.totals.total, itemCount: data.items.length },
    });
  }

  const monthPart = type === "calendar" && data.calMonth ? "_" + data.calMonth : "";
  const filename = "OnferenceTV_" + slug(type) + "_" + slug(data.cName || "Client")
    + "_" + slug(data.projName) + monthPart + (data.estNo ? "_" + slug(data.estNo) : "") + ".doc";
  return { html, filename };
}

/** Estimate for one selected card, priced independently — the legacy "Propose" flow. */
export async function generateProposal(
  user: CurrentUser, projectId: string,
  proposal: ProposalInput,
  mode: "preview" | "word" = "preview"
) {
  if (!canGenerate(user.role, "estimate")) {
    throw new ForbiddenError("Your role cannot generate a proposal.");
  }
  const forWord = mode === "word";
  const data = await buildDocData(projectId, { proposal, forWord });
  const html = buildEstimate(data);

  if (forWord) {
    await Proposal.create({
      projectId, no: data.estNo, lineItemIds: [proposal.lineItemId],
      gstMode: data.gstMode, override: proposal.override ?? {},
      partner: proposal.partner ?? {}, ownerId: user.id,
    });
    await writeAudit(user, "document.proposal", "document", projectId, {
      projectId,
      label: `Generated a proposal for “${data.projName}”`,
      meta: { number: data.estNo, total: data.totals.total, lineItemId: proposal.lineItemId },
    });
  }

  const filename = "OnferenceTV_Proposal_" + slug(data.cName) + "_" + slug(data.projName) + ".doc";
  return { html, filename, data };
}

export async function generateICS(user: CurrentUser, projectId: string) {
  const data = await buildDocData(projectId);
  await writeAudit(user, "document.ics", "document", projectId, {
    projectId,
    label: `Downloaded calendar reminders for “${data.projName}”`,
  });
  return {
    ics: buildICS(data),
    filename: "OnferenceTV_Reminders_" + slug(data.projName || data.cName) + ".ics",
  };
}
