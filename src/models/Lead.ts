import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'

export const LEAD_NEEDS = ['project', 'engineers', 'training', 'combination'] as const
export const LEAD_STATUSES = [
  'new',
  'contacted',
  'qualified',
  'won',
  'lost',
] as const

export type LeadNeed = (typeof LEAD_NEEDS)[number]
export type LeadStatus = (typeof LEAD_STATUSES)[number]

const leadNoteSchema = new Schema(
  {
    body: { type: String, required: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User' },
    authorName: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

const leadSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    company: { type: String, trim: true, maxlength: 160, default: '' },
    need: { type: String, enum: LEAD_NEEDS, required: true },
    message: { type: String, required: true, maxlength: 5000 },
    status: { type: String, enum: LEAD_STATUSES, default: 'new', index: true },
    sourcePage: { type: String, maxlength: 200, default: '/contact' },
    utm: {
      source: String,
      medium: String,
      campaign: String,
      term: String,
      content: String,
    },
    visitorId: { type: String, index: true },
    ipHash: { type: String },
    userAgent: { type: String, maxlength: 500 },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    notes: [leadNoteSchema],
  },
  { timestamps: true },
)

leadSchema.index({ createdAt: -1 })
leadSchema.index({ email: 1, createdAt: -1 })

export type LeadDocument = InferSchemaType<typeof leadSchema> & {
  _id: mongoose.Types.ObjectId
}

export const Lead: Model<LeadDocument> =
  mongoose.models.Lead || mongoose.model<LeadDocument>('Lead', leadSchema)
