import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'

export const EMAIL_TEMPLATE_KEYS = ['lead_admin', 'lead_autoreply'] as const
export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number]

const emailTemplateSchema = new Schema(
  {
    key: { type: String, enum: EMAIL_TEMPLATE_KEYS, required: true, unique: true },
    subject: { type: String, required: true, maxlength: 200 },
    htmlBody: { type: String, required: true, maxlength: 20000 },
  },
  { timestamps: true },
)

export type EmailTemplateDocument = InferSchemaType<typeof emailTemplateSchema> & {
  _id: mongoose.Types.ObjectId
}

export const EmailTemplate: Model<EmailTemplateDocument> =
  mongoose.models.EmailTemplate ||
  mongoose.model<EmailTemplateDocument>('EmailTemplate', emailTemplateSchema)
