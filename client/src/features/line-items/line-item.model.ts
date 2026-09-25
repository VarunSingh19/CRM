import mongoose, { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

/**
 * Referenced (not embedded) so ops can query line items across ALL projects
 * for the shared content calendar without loading every project.
 */
const lineItemSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },

    section: { type: String, required: true },
    name: { type: String, required: true },     // offering name
    topic: { type: String, default: "" },
    projDesc: { type: String, default: "" },
    status: { type: String, enum: ["Planner", "In Progress", "Done", "Cancelled"], default: "Planner", index: true },

    cardType: { type: String, default: "" },
    promo: { type: String, default: "" },
    stream: { type: String, default: "" },
    produced: { type: String, default: "" },
    incl: { type: String, default: "" },
    excl: { type: String, default: "" },
    dev: { type: String, default: "" },
    duration: { type: String, default: "" },

    // commercials (hidden from ops at field level)
    qty: { type: Number, default: 1 },
    rate: { type: Number, default: 0 },
    amountOverride: { type: Schema.Types.Mixed, default: "" },
    discType: { type: String, enum: ["amount", "percent"], default: "amount" },
    discValue: { type: Number, default: 0 },

    // production / kickoff
    cardName: { type: String, default: "" },
    recDate: { type: String, default: "" },
    relDate: { type: String, default: "" },
    cardEnd: { type: String, default: "" },
    videoEnd: { type: String, default: "" },
    brandEnd: { type: String, default: "" },

    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Query shapes actually used: items of a project in display order, the
// cross-project calendar, and dashboard roll-ups by status.
lineItemSchema.index({ projectId: 1, sortOrder: 1, createdAt: 1 });
lineItemSchema.index({ relDate: 1 });
lineItemSchema.index({ status: 1, relDate: 1 });

export type LineItemDoc = InferSchemaType<typeof lineItemSchema> & { _id: mongoose.Types.ObjectId };
// A dev server keeps the compiled model on the mongoose singleton across hot
// reloads, so a schema change has no effect until a full restart — mongoose
// silently strips unknown keys on write instead. Recompile in development.
if (process.env.NODE_ENV !== "production" && models.LineItem) {
  mongoose.deleteModel("LineItem");
}

export const LineItem = (models.LineItem || model("LineItem", lineItemSchema)) as Model<any>;
