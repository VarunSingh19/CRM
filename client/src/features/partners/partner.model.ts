import mongoose, {
  Schema,
  model,
  models,
  type Model,
  type InferSchemaType,
} from "mongoose";

const partnerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["Receivable", "Payable", "Barter"],
      default: "Receivable",
    },
    contact: { type: String, default: "" },
    email: { type: String, default: "" },
    mobile: { type: String, default: "" },
    gstin: { type: String, default: "" },
    addr: { type: String, default: "" },
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

partnerSchema.index({ archived: 1, name: 1 });
partnerSchema.index({ ownerId: 1, archived: 1 });

export type PartnerDoc = InferSchemaType<typeof partnerSchema> & {
  _id: mongoose.Types.ObjectId;
};
// A dev server keeps the compiled model on the mongoose singleton across hot
// reloads, so a schema change has no effect until a full restart — mongoose
// silently strips unknown keys on write instead. Recompile in development.
if (process.env.NODE_ENV !== "production" && models.Partner) {
  mongoose.deleteModel("Partner");
}

export const Partner = (models.Partner ||
  model("Partner", partnerSchema)) as Model<any>;
