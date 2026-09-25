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

/** Singleton-ish company/entity + bank defaults, editable by admin only.
 *  Seeded with the exact prefills the original single-file tool shipped. */
const settingsSchema = new Schema(
  {
    key: { type: String, default: "company", unique: true },
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
    defaultTerms: { type: String, default: DEFAULT_TERMS },
    defaultSac: { type: String, default: DEFAULT_SAC },
    defaultValidity: { type: String, default: DEFAULT_VALIDITY },
  },
  { timestamps: true },
);

export type SettingsDoc = InferSchemaType<typeof settingsSchema> & {
  _id: mongoose.Types.ObjectId;
};
// A dev server keeps the compiled model on the mongoose singleton across hot
// reloads, so a schema change has no effect until a full restart — mongoose
// silently strips unknown keys on write instead. Recompile in development.
if (process.env.NODE_ENV !== "production" && models.Settings) {
  mongoose.deleteModel("Settings");
}

export const Settings = (models.Settings ||
  model("Settings", settingsSchema)) as Model<any>;
