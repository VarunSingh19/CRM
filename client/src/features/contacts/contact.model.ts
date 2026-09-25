import mongoose, { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

/**
 * One person's association with one partner.
 *
 * Partner still carries contact/email/mobile as the present contact, because
 * every document and every project snapshot reads those three fields. This
 * collection is the history behind them: when the person at a partner changes,
 * the old row stays and a new one is added, so the partner they left still
 * shows who used to be there and the person can be found again at their new
 * company.
 *
 * Someone who moves companies gets a second row rather than an edited one —
 * one row per person-at-a-company, never a person edited across companies.
 */
const contactSchema = new Schema(
  {
    partnerId: { type: Schema.Types.ObjectId, ref: "Partner", required: true },
    /** As typed, e.g. "R. Menon, Brand Manager". Kept as one field to match the
     *  single cContact string carried on projects and printed on documents. */
    name: { type: String, required: true, trim: true },
    email: { type: String, default: "" },
    mobile: { type: String, default: "" },
    /** The partner's present contact. At most one row per partner holds this. */
    current: { type: Boolean, default: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// the picker lists a partner's own people first, the current one at the top
contactSchema.index({ partnerId: 1, current: -1, name: 1 });
// and everyone else underneath, searched by name
contactSchema.index({ name: 1 });

export type ContactDoc = InferSchemaType<typeof contactSchema> & { _id: mongoose.Types.ObjectId };
// A dev server keeps the compiled model on the mongoose singleton across hot
// reloads, so a schema change has no effect until a full restart — mongoose
// silently strips unknown keys on write instead. Recompile in development.
if (process.env.NODE_ENV !== "production" && models.Contact) {
  mongoose.deleteModel("Contact");
}

export const Contact = (models.Contact || model("Contact", contactSchema)) as Model<any>;
