import mongoose, { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const generatedDocumentSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    type: { type: String, enum: ["estimate", "kickoff", "invoice", "calendar"], required: true },
    number: { type: String, default: "" },
    // snapshot of the totals at generation time (audit / reproducibility)
    snapshot: { type: Schema.Types.Mixed, default: {} },
    generatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export type GeneratedDocumentDoc = InferSchemaType<typeof generatedDocumentSchema> & { _id: mongoose.Types.ObjectId };
// A dev server keeps the compiled model on the mongoose singleton across hot
// reloads, so a schema change has no effect until a full restart — mongoose
// silently strips unknown keys on write instead. Recompile in development.
if (process.env.NODE_ENV !== "production" && models.GeneratedDocument) {
  mongoose.deleteModel("GeneratedDocument");
}

export const GeneratedDocument = (models.GeneratedDocument || model("GeneratedDocument", generatedDocumentSchema)) as Model<any>;
