import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'

export const LEGAL_SLUGS = ['privacy', 'terms', 'cookies'] as const
export type LegalSlug = (typeof LEGAL_SLUGS)[number]

const legalSectionSchema = new Schema(
  {
    heading: { type: String, required: true, maxlength: 200 },
    paragraphs: [{ type: String, maxlength: 5000 }],
    bullets: [{ type: String, maxlength: 1000 }],
  },
  { _id: false },
)

const legalPageSchema = new Schema(
  {
    slug: { type: String, enum: LEGAL_SLUGS, required: true, unique: true },
    path: { type: String, required: true },
    title: { type: String, required: true, maxlength: 200 },
    eyebrow: { type: String, default: 'Legal', maxlength: 80 },
    intro: { type: String, required: true, maxlength: 2000 },
    sections: [legalSectionSchema],
    published: { type: Boolean, default: true },
    updatedLabel: { type: String, default: '' },
  },
  { timestamps: true },
)

export type LegalPageDocument = InferSchemaType<typeof legalPageSchema> & {
  _id: mongoose.Types.ObjectId
}

export const LegalPage: Model<LegalPageDocument> =
  mongoose.models.LegalPage ||
  mongoose.model<LegalPageDocument>('LegalPage', legalPageSchema)
