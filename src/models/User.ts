import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'

export const USER_ROLES = ['super_admin', 'editor', 'viewer'] as const
export type UserRole = (typeof USER_ROLES)[number]

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: USER_ROLES, default: 'viewer' },
    active: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
  },
  { timestamps: true },
)

export type UserDocument = InferSchemaType<typeof userSchema> & {
  _id: mongoose.Types.ObjectId
}

export const User: Model<UserDocument> =
  mongoose.models.User || mongoose.model<UserDocument>('User', userSchema)
