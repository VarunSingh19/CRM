import mongoose, {
  Schema,
  model,
  models,
  type Model,
  type InferSchemaType,
} from "mongoose";

/** One counter per Indian financial year, e.g. { key: "2026-27", seq: 42 }.
 *  Replaces the legacy tool's per-browser localStorage counter with a shared,
 *  atomic, server-side sequence so two people cannot mint the same number. */
const estimateSequenceSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type EstimateSequenceDoc = InferSchemaType<
  typeof estimateSequenceSchema
> & { _id: mongoose.Types.ObjectId };
// A dev server keeps the compiled model on the mongoose singleton across hot
// reloads, so a schema change has no effect until a full restart — mongoose
// silently strips unknown keys on write instead. Recompile in development.
if (process.env.NODE_ENV !== "production" && models.EstimateSequence) {
  mongoose.deleteModel("EstimateSequence");
}

export const EstimateSequence = (models.EstimateSequence ||
  model("EstimateSequence", estimateSequenceSchema)) as Model<any>;
