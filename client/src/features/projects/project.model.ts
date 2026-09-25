import mongoose, {
  Schema,
  model,
  models,
  type Model,
  type InferSchemaType,
} from "mongoose";
import {
  COMPANY_DEFAULTS,
  DEFAULT_TERMS,
  DEFAULT_SAC,
  DEFAULT_VALIDITY,
} from "@/lib/defaults";

/** Company/issuing-entity snapshot carried on each project (defaults come from Settings). */
const entitySchema = new Schema(
  {
    coName: { type: String, default: COMPANY_DEFAULTS.coName },
    coGstin: { type: String, default: COMPANY_DEFAULTS.coGstin },
    coLlpin: { type: String, default: COMPANY_DEFAULTS.coLlpin },
    coPan: { type: String, default: COMPANY_DEFAULTS.coPan },
    coTan: { type: String, default: COMPANY_DEFAULTS.coTan },
    coMsme: { type: String, default: COMPANY_DEFAULTS.coMsme },
    coAddr: { type: String, default: COMPANY_DEFAULTS.coAddr },
    coEmail: { type: String, default: COMPANY_DEFAULTS.coEmail },
    coSite: { type: String, default: COMPANY_DEFAULTS.coSite },
    coBank: { type: String, default: COMPANY_DEFAULTS.coBank },
  },
  { _id: false },
);

const projectSchema = new Schema(
  {
    projName: { type: String, required: true, trim: true },
    partnerType: {
      type: String,
      enum: ["Receivable", "Payable", "Barter"],
      default: "Receivable",
    },
    /**
     * Barter is settled in kind, so a barter project shows no commercials
     * unless someone opts in here. Receivable and Payable always show them and
     * ignore this flag.
     */
    barterCommercials: { type: Boolean, default: false },

    // partner snapshot on the project (denormalised, as the original form works)
    partnerId: { type: Schema.Types.ObjectId, ref: "Partner" },
    cName: { type: String, default: "" },
    cContact: { type: String, default: "" },
    cEmail: { type: String, default: "" },
    cMobile: { type: String, default: "" },
    cAddr: { type: String, default: "" },
    cGstin: { type: String, default: "" },

    // document meta
    date: { type: String, default: "" }, // yyyy-mm-dd (kept as string to match the form)
    estNo: { type: String, default: "" },
    validity: { type: String, default: DEFAULT_VALIDITY },
    pos: { type: String, default: "" }, // place of supply
    cPo: { type: String, default: "" }, // partner PO

    // tax + terms
    gstMode: { type: String, enum: ["intra", "inter"], default: "intra" },
    sac: { type: String, default: DEFAULT_SAC },
    terms: { type: String, default: DEFAULT_TERMS },
    docDiscType: {
      type: String,
      enum: ["amount", "percent"],
      default: "amount",
    },
    docDiscValue: { type: Number, default: 0 },

    // kickoff
    koStart: { type: String, default: "" },
    koEnd: { type: String, default: "" },
    koContract: { type: String, default: "" },
    koOwner: { type: String, default: "" },
    koProducer: { type: String, default: "" },
    koNotes: { type: String, default: "" },

    entity: { type: entitySchema, default: () => ({}) },

    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// List views sort by recency; sales lists are scoped to an owner.
projectSchema.index({ archived: 1, updatedAt: -1 });
projectSchema.index({ ownerId: 1, archived: 1, updatedAt: -1 });

export type ProjectDoc = InferSchemaType<typeof projectSchema> & {
  _id: mongoose.Types.ObjectId;
};
// A dev server keeps the compiled model on the mongoose singleton across hot
// reloads, so a schema change has no effect until a full restart — mongoose
// silently strips unknown keys on write instead. Recompile in development.
if (process.env.NODE_ENV !== "production" && models.Project) {
  mongoose.deleteModel("Project");
}

export const Project = (models.Project ||
  model("Project", projectSchema)) as Model<any>;
