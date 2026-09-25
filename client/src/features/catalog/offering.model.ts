import mongoose, { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const offeringSchema = new Schema(
  {
    section: { type: String, required: true, index: true },
    name: { type: String, required: true, unique: true },
    cardTypes: { type: [String], default: [] },
    promo: { type: [String], default: [] },
    stream: { type: [String], default: [] },
    produced: { type: [String], default: [] },
    incl: { type: String, default: "" },
    excl: { type: String, default: "" },
    dev: { type: String, default: "" },
    duration: { type: String, default: "" },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

offeringSchema.index({ active: 1, section: 1, sortOrder: 1 });

export type OfferingDoc = InferSchemaType<typeof offeringSchema> & { _id: mongoose.Types.ObjectId };
// A dev server keeps the compiled model on the mongoose singleton across hot
// reloads, so a schema change has no effect until a full restart — mongoose
// silently strips unknown keys on write instead. Recompile in development.
if (process.env.NODE_ENV !== "production" && models.Offering) {
  mongoose.deleteModel("Offering");
}

export const Offering = (models.Offering || model("Offering", offeringSchema)) as Model<any>;
