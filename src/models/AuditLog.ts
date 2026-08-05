import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'

const auditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    actorEmail: { type: String },
    action: { type: String, required: true, maxlength: 120 },
    entity: { type: String, required: true, maxlength: 80 },
    entityId: { type: String },
    diff: { type: Schema.Types.Mixed },
    ipHash: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

auditLogSchema.index({ createdAt: -1 })

export type AuditLogDocument = InferSchemaType<typeof auditLogSchema> & {
  _id: mongoose.Types.ObjectId
}

export const AuditLog: Model<AuditLogDocument> =
  mongoose.models.AuditLog ||
  mongoose.model<AuditLogDocument>('AuditLog', auditLogSchema)
