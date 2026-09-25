import mongoose, {
  Schema,
  model,
  models,
  type Model,
  type InferSchemaType,
} from "mongoose";

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["admin", "sales", "ops"], required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

/**
 * Email is a sign-in credential alongside username, so two accounts must never
 * share one. Partial, because accounts without an email store "" and a plain
 * unique index would let only one of those exist.
 */
userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $gt: "" } } },
);

export type UserDoc = InferSchemaType<typeof userSchema> & {
  _id: mongoose.Types.ObjectId;
};
// A dev server keeps the compiled model on the mongoose singleton across hot
// reloads, so a schema change has no effect until a full restart — mongoose
// silently strips unknown keys on write instead. Recompile in development.
if (process.env.NODE_ENV !== "production" && models.User) {
  mongoose.deleteModel("User");
}

export const User = (models.User || model("User", userSchema)) as Model<any>;
