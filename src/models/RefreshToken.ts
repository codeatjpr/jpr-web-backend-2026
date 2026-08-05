import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'

const refreshTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    userAgent: { type: String },
    ipHash: { type: String },
  },
  { timestamps: true },
)

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
refreshTokenSchema.index({ userId: 1 })

export type RefreshTokenDocument = InferSchemaType<typeof refreshTokenSchema> & {
  _id: mongoose.Types.ObjectId
}

export const RefreshToken: Model<RefreshTokenDocument> =
  mongoose.models.RefreshToken ||
  mongoose.model<RefreshTokenDocument>('RefreshToken', refreshTokenSchema)
