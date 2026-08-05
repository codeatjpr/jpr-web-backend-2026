import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireRoles } from '../../middleware/auth.js'
import { leadLimiter } from '../../middleware/rateLimit.js'
import { validate } from '../../middleware/validate.js'
import { Lead, LEAD_NEEDS, LEAD_STATUSES } from '../../models/Lead.js'
import { sendLeadEmails } from '../../services/email.js'
import { writeAudit } from '../../services/audit.js'
import { hashIp } from '../../utils/crypto.js'
import { getClientIp, stripHtml } from '../../utils/request.js'
import { AppError } from '../../utils/errors.js'

const publicLeadSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  company: z.string().trim().max(160).optional().default(''),
  need: z.enum(LEAD_NEEDS),
  message: z.string().trim().min(1).max(5000),
  sourcePage: z.string().max(200).optional().default('/contact'),
  visitorId: z.string().max(80).optional(),
  honeypot: z.string().max(100).optional().default(''),
  utm: z
    .object({
      source: z.string().max(100).optional(),
      medium: z.string().max(100).optional(),
      campaign: z.string().max(100).optional(),
      term: z.string().max(100).optional(),
      content: z.string().max(100).optional(),
    })
    .optional(),
})

const updateLeadSchema = z.object({
  status: z.enum(LEAD_STATUSES).optional(),
  assignedTo: z.string().nullable().optional(),
  note: z.string().min(1).max(2000).optional(),
})

export const publicLeadsRouter = Router()
export const adminLeadsRouter = Router()

publicLeadsRouter.post(
  '/',
  leadLimiter,
  validate({ body: publicLeadSchema }),
  async (req, res, next) => {
    try {
      // Honeypot: bots fill this; respond success without storing
      if (req.body.honeypot) {
        res.status(204).send()
        return
      }

      const lead = await Lead.create({
        name: stripHtml(req.body.name),
        email: req.body.email.toLowerCase(),
        company: stripHtml(req.body.company || ''),
        need: req.body.need,
        message: stripHtml(req.body.message),
        sourcePage: req.body.sourcePage || '/contact',
        visitorId: req.body.visitorId,
        utm: req.body.utm,
        ipHash: hashIp(getClientIp(req)),
        userAgent: String(req.headers['user-agent'] || '').slice(0, 500),
      })

      void sendLeadEmails(lead)

      res.status(201).json({
        data: {
          id: lead._id,
          message: 'Inquiry received',
        },
      })
    } catch (err) {
      next(err)
    }
  },
)

adminLeadsRouter.use(requireAuth, requireRoles('super_admin', 'editor', 'viewer'))

adminLeadsRouter.get('/', async (req, res, next) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const need = typeof req.query.need === 'string' ? req.query.need : undefined
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20))
    const filter: Record<string, unknown> = {}
    if (status && LEAD_STATUSES.includes(status as (typeof LEAD_STATUSES)[number])) {
      filter.status = status
    }
    if (need && LEAD_NEEDS.includes(need as (typeof LEAD_NEEDS)[number])) {
      filter.need = need
    }
    if (q) {
      filter.$or = [
        { name: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { email: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { company: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      ]
    }

    const [items, total] = await Promise.all([
      Lead.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Lead.countDocuments(filter),
    ])

    res.json({
      data: items,
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (err) {
    next(err)
  }
})

adminLeadsRouter.get('/export/csv', requireRoles('super_admin', 'editor'), async (_req, res, next) => {
  try {
    const leads = await Lead.find().sort({ createdAt: -1 }).limit(5000).lean()
    const header = 'id,name,email,company,need,status,createdAt\n'
    const rows = leads
      .map((l) =>
        [
          l._id,
          csvEscape(l.name),
          csvEscape(l.email),
          csvEscape(l.company || ''),
          l.need,
          l.status,
          (l as { createdAt?: Date }).createdAt?.toISOString?.() || '',
        ].join(','),
      )
      .join('\n')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"')
    res.send(header + rows)
  } catch (err) {
    next(err)
  }
})

adminLeadsRouter.get('/:id', async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id).lean()
    if (!lead) throw new AppError(404, 'Lead not found', 'NOT_FOUND')
    res.json({ data: lead })
  } catch (err) {
    next(err)
  }
})

adminLeadsRouter.patch(
  '/:id',
  requireRoles('super_admin', 'editor'),
  validate({ body: updateLeadSchema }),
  async (req, res, next) => {
    try {
      const lead = await Lead.findById(req.params.id)
      if (!lead) throw new AppError(404, 'Lead not found', 'NOT_FOUND')

      if (req.body.status) lead.status = req.body.status
      if (req.body.assignedTo !== undefined) {
        lead.assignedTo = req.body.assignedTo || undefined
      }
      if (req.body.note) {
        lead.notes.push({
          body: stripHtml(req.body.note),
          authorId: req.user!.id as unknown as import('mongoose').Types.ObjectId,
          authorName: req.user!.name,
        })
      }
      await lead.save()

      await writeAudit({
        actor: req.user,
        action: 'update',
        entity: 'lead',
        entityId: String(lead._id),
        diff: req.body,
        ipHash: hashIp(getClientIp(req)),
      })

      res.json({ data: lead })
    } catch (err) {
      next(err)
    }
  },
)

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}
