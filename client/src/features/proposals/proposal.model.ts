import mongoose, {
  Schema,
  model,
  models,
  type Model,
  type InferSchemaType,
} from "mongoose";

const proposalSchema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    no: { type: String, default: "" },
    lineItemIds: { type: [Schema.Types.ObjectId], default: [] },
    gstMode: { type: String, enum: ["intra", "inter"], default: "intra" },
    // commercial override applied to the selected items
    override: {
      qty: { type: Number, default: 1 },
      rate: { type: Number, default: 0 },
      discType: {
        type: String,
        enum: ["amount", "percent"],
        default: "amount",
      },
      discValue: { type: Number, default: 0 },
    },
    partner: {
      name: String,
      type: { type: String },
      email: String,
      mobile: String,
      contact: String,
      gstin: String,
      addr: String,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

export type ProposalDoc = InferSchemaType<typeof proposalSchema> & {
  _id: mongoose.Types.ObjectId;
};
// A dev server keeps the compiled model on the mongoose singleton across hot
// reloads, so a schema change has no effect until a full restart — mongoose
// silently strips unknown keys on write instead. Recompile in development.
if (process.env.NODE_ENV !== "production" && models.Proposal) {
  mongoose.deleteModel("Proposal");
}

export const Proposal = (models.Proposal ||
  model("Proposal", proposalSchema)) as Model<any>;
