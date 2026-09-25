import mongoose, { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const auditLogSchema = new Schema(
  {
    // Optional: a failed sign-in against an unknown username has no actor to point at.
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    actorName: { type: String, default: "" },
    // Snapshot, not a lookup. Promote someone from sales to admin later and the
    // log must still say what they were when they acted.
    actorRole: { type: String, default: "" },
    action: { type: String, required: true },     // e.g. "project.create"
    resource: { type: String, required: true },
    resourceId: { type: String, default: "" },
    // Lets one query answer "everything that happened to this project",
    // including its line items and generated documents.
    projectId: { type: String, default: "" },
    // Pre-rendered summary, so the table is scannable without expanding rows.
    label: { type: String, default: "" },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1 });
auditLogSchema.index({ projectId: 1, createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

export type AuditLogDoc = InferSchemaType<typeof auditLogSchema> & { _id: mongoose.Types.ObjectId };
// A dev server keeps the compiled model on the mongoose singleton across hot
// reloads, so adding a field above has no effect until a full restart —
// mongoose silently strips the unknown keys on write. Recompile in dev.
if (process.env.NODE_ENV !== "production" && models.AuditLog) {
  mongoose.deleteModel("AuditLog");
}

export const AuditLog = (models.AuditLog || model("AuditLog", auditLogSchema)) as Model<any>;
