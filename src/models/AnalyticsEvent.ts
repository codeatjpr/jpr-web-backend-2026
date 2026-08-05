import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'

export const ANALYTICS_EVENT_TYPES = [
  'page_view',
  'session_start',
  'cta_click',
  'form_start',
  'form_submit',
  'outbound_click',
  'page_leave',
] as const

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number]

const analyticsEventSchema = new Schema(
  {
    type: { type: String, enum: ANALYTICS_EVENT_TYPES, required: true, index: true },
    path: { type: String, required: true, maxlength: 300, index: true },
    title: { type: String, maxlength: 300 },
    referrer: { type: String, maxlength: 500 },
    utm: {
      source: String,
      medium: String,
      campaign: String,
      term: String,
      content: String,
    },
    visitorId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    device: { type: String, enum: ['mobile', 'desktop', 'tablet', 'unknown'], default: 'unknown' },
    browser: { type: String, maxlength: 80 },
    os: { type: String, maxlength: 80 },
    country: { type: String, maxlength: 80, index: true },
    language: { type: String, maxlength: 40 },
    screenWidth: { type: Number },
    meta: { type: Schema.Types.Mixed },
    ipHash: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

analyticsEventSchema.index({ createdAt: -1 })
analyticsEventSchema.index({ type: 1, createdAt: -1 })
// Retain raw events ~24 months
analyticsEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 730 })

export type AnalyticsEventDocument = InferSchemaType<typeof analyticsEventSchema> & {
  _id: mongoose.Types.ObjectId
}

export const AnalyticsEvent: Model<AnalyticsEventDocument> =
  mongoose.models.AnalyticsEvent ||
  mongoose.model<AnalyticsEventDocument>('AnalyticsEvent', analyticsEventSchema)
