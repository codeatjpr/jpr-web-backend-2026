import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireRoles } from '../../middleware/auth.js'
import { validate } from '../../middleware/validate.js'
import { SiteSettings } from '../../models/SiteSettings.js'
import { EmailTemplate, EMAIL_TEMPLATE_KEYS } from '../../models/EmailTemplate.js'
import { writeAudit } from '../../services/audit.js'
import { hashIp } from '../../utils/crypto.js'
import { getClientIp, stripHtml } from '../../utils/request.js'
import { sanitizeUserHtml } from '../../utils/sanitize.js'
export const publicSettingsRouter = Router()
export const adminSettingsRouter = Router()

publicSettingsRouter.get('/public', async (_req, res, next) => {
  try {
    const settings = await SiteSettings.findOne({ key: 'default' }).lean()
    res.json({
      data: {
        contactEmail: settings?.contactEmail,
        phone: settings?.phone,
        phoneHref: settings?.phoneHref,
        socialLinks: settings?.socialLinks || [],
        formSuccessTitle: settings?.formSuccessTitle,
        formSuccessBody: settings?.formSuccessBody,
        cookieBannerTitle: settings?.cookieBannerTitle,
        cookieBannerBody: settings?.cookieBannerBody,
        analyticsEnabled: settings?.analyticsEnabled !== false,
      },
    })
  } catch (err) {
    next(err)
  }
})

const settingsSchema = z.object({
  contactEmail: z.string().email().optional(),
  phone: z.string().max(40).optional(),
  phoneHref: z.string().max(60).optional(),
  socialLinks: z
    .array(
      z.object({
        id: z.string().max(40),
        label: z.string().max(40),
        href: z.string().url().max(300),
      }),
    )
    .optional(),
  notificationEmails: z.array(z.string().email()).optional(),
  autoReplyEnabled: z.boolean().optional(),
  notificationsEnabled: z.boolean().optional(),
  formSuccessTitle: z.string().max(200).optional(),
  formSuccessBody: z.string().max(1000).optional(),
  cookieBannerTitle: z.string().max(120).optional(),
  cookieBannerBody: z.string().max(1000).optional(),
  analyticsEnabled: z.boolean().optional(),
  retentionDays: z.number().int().min(30).max(1095).optional(),
})

const templateSchema = z.object({
  subject: z.string().min(1).max(200),
  htmlBody: z.string().min(1).max(20000),
})

adminSettingsRouter.use(requireAuth)

adminSettingsRouter.get('/', requireRoles('super_admin', 'editor', 'viewer'), async (_req, res, next) => {
  try {
    const settings = await SiteSettings.findOne({ key: 'default' }).lean()
    res.json({ data: settings })
  } catch (err) {
    next(err)
  }
})

adminSettingsRouter.put(
  '/',
  requireRoles('super_admin', 'editor'),
  validate({ body: settingsSchema }),
  async (req, res, next) => {
    try {
      const body = { ...req.body }
      if (body.formSuccessTitle) body.formSuccessTitle = stripHtml(body.formSuccessTitle)
      if (body.formSuccessBody) body.formSuccessBody = stripHtml(body.formSuccessBody)
      if (body.cookieBannerTitle) body.cookieBannerTitle = stripHtml(body.cookieBannerTitle)
      if (body.cookieBannerBody) body.cookieBannerBody = stripHtml(body.cookieBannerBody)

      const settings = await SiteSettings.findOneAndUpdate(
        { key: 'default' },
        { $set: body },
        { upsert: true, new: true },
      )

      await writeAudit({
        actor: req.user,
        action: 'update',
        entity: 'settings',
        entityId: 'default',
        ipHash: hashIp(getClientIp(req)),
      })

      res.json({ data: settings })
    } catch (err) {
      next(err)
    }
  },
)

adminSettingsRouter.get(
  '/email-templates',
  requireRoles('super_admin', 'editor', 'viewer'),
  async (_req, res, next) => {
    try {
      const templates = await EmailTemplate.find().lean()
      res.json({ data: templates })
    } catch (err) {
      next(err)
    }
  },
)

adminSettingsRouter.put(
  '/email-templates/:key',
  requireRoles('super_admin', 'editor'),
  validate({
    params: z.object({ key: z.enum(EMAIL_TEMPLATE_KEYS) }),
    body: templateSchema,
  }),
  async (req, res, next) => {
    try {
      const key = req.params.key as (typeof EMAIL_TEMPLATE_KEYS)[number]
      const template = await EmailTemplate.findOneAndUpdate(
        { key },
        {
          $set: {
            subject: stripHtml(req.body.subject),
            htmlBody: sanitizeUserHtml(req.body.htmlBody),
          },
        },
        { upsert: true, new: true },
      )

      await writeAudit({
        actor: req.user,
        action: 'update',
        entity: 'email_template',
        entityId: key,
        ipHash: hashIp(getClientIp(req)),
      })

      res.json({ data: template })
    } catch (err) {
      next(err)
    }
  },
)

adminSettingsRouter.get(
  '/audit',
  requireRoles('super_admin', 'editor'),
  async (req, res, next) => {
    try {
      const { AuditLog } = await import('../../models/AuditLog.js')
      const page = Math.max(1, Number(req.query.page) || 1)
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50))
      const [items, total] = await Promise.all([
        AuditLog.find()
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        AuditLog.countDocuments(),
      ])
      res.json({ data: items, meta: { page, limit, total } })
    } catch (err) {
      next(err)
    }
  },
)
