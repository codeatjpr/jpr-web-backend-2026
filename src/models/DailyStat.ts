import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'

const namedCountSchema = new Schema(
  {
    name: { type: String, required: true },
    count: { type: Number, required: true, default: 0 },
  },
  { _id: false },
)

const dailyStatSchema = new Schema(
  {
    date: { type: String, required: true, unique: true }, // YYYY-MM-DD UTC
    pageViews: { type: Number, default: 0 },
    visitors: { type: Number, default: 0 },
    uniqueVisitors: { type: Number, default: 0 },
    submissions: { type: Number, default: 0 },
    topPages: [namedCountSchema],
    sources: [namedCountSchema],
    devices: [namedCountSchema],
    countries: [namedCountSchema],
  },
  { timestamps: true },
)

export type DailyStatDocument = InferSchemaType<typeof dailyStatSchema> & {
  _id: mongoose.Types.ObjectId
}

export const DailyStat: Model<DailyStatDocument> =
  mongoose.models.DailyStat ||
  mongoose.model<DailyStatDocument>('DailyStat', dailyStatSchema)
