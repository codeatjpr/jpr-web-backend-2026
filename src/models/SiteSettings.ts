import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'

const socialLinkSchema = new Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    href: { type: String, required: true },
  },
  { _id: false },
)

const siteSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: 'default' },
    contactEmail: { type: String, default: 'info@jprtechnosoft.com' },
    phone: { type: String, default: '01205106084' },
    phoneHref: { type: String, default: 'tel:+911205106084' },
    socialLinks: [socialLinkSchema],
    notificationEmails: [{ type: String }],
    autoReplyEnabled: { type: Boolean, default: true },
    notificationsEnabled: { type: Boolean, default: true },
    formSuccessTitle: { type: String, default: 'Message received.' },
    formSuccessBody: {
      type: String,
      default:
        'Thank you. We aim to respond with a recommended next step within one business day.',
    },
    cookieBannerTitle: { type: String, default: 'Cookies & privacy' },
    cookieBannerBody: {
      type: String,
      default:
        'We use essential cookies to run the site and optional analytics cookies to understand aggregate traffic. You can change your choice anytime.',
    },
    analyticsEnabled: { type: Boolean, default: true },
    retentionDays: { type: Number, default: 730 },
  },
  { timestamps: true },
)

export type SiteSettingsDocument = InferSchemaType<typeof siteSettingsSchema> & {
  _id: mongoose.Types.ObjectId
}

export const SiteSettings: Model<SiteSettingsDocument> =
  mongoose.models.SiteSettings ||
  mongoose.model<SiteSettingsDocument>('SiteSettings', siteSettingsSchema)
