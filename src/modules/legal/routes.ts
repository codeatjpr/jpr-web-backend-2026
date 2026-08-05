import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireRoles } from '../../middleware/auth.js'
import { validate } from '../../middleware/validate.js'
import { LegalPage, LEGAL_SLUGS } from '../../models/LegalPage.js'
import { writeAudit } from '../../services/audit.js'
import { hashIp } from '../../utils/crypto.js'
import { getClientIp, stripHtml } from '../../utils/request.js'
import { AppError } from '../../utils/errors.js'

const sectionSchema = z.object({
  heading: z.string().min(1).max(200),
  paragraphs: z.array(z.string().max(5000)).default([]),
  bullets: z.array(z.string().max(1000)).optional(),
})

const upsertSchema = z.object({
  title: z.string().min(1).max(200),
  eyebrow: z.string().max(80).optional(),
  intro: z.string().min(1).max(2000),
  sections: z.array(sectionSchema).min(1),
  published: z.boolean().optional(),
})

export const publicLegalRouter = Router()
export const adminLegalRouter = Router()

publicLegalRouter.get('/:slug', async (req, res, next) => {
  try {
    const slug = req.params.slug
    if (!LEGAL_SLUGS.includes(slug as (typeof LEGAL_SLUGS)[number])) {
      throw new AppError(404, 'Legal page not found', 'NOT_FOUND')
    }
    const page = await LegalPage.findOne({ slug, published: true }).lean()
    if (!page) throw new AppError(404, 'Legal page not found', 'NOT_FOUND')
    res.json({ data: page })
  } catch (err) {
    next(err)
  }
})

adminLegalRouter.use(requireAuth)

adminLegalRouter.get('/', requireRoles('super_admin', 'editor', 'viewer'), async (_req, res, next) => {
  try {
    const pages = await LegalPage.find().sort({ slug: 1 }).lean()
    res.json({ data: pages })
  } catch (err) {
    next(err)
  }
})

adminLegalRouter.put(
  '/:slug',
  requireRoles('super_admin', 'editor'),
  validate({
    params: z.object({ slug: z.enum(LEGAL_SLUGS) }),
    body: upsertSchema,
  }),
  async (req, res, next) => {
    try {
      const slug = req.params.slug as (typeof LEGAL_SLUGS)[number]
      const sections = req.body.sections.map((s: z.infer<typeof sectionSchema>) => ({
        heading: stripHtml(s.heading),
        paragraphs: s.paragraphs.map((p) => stripHtml(p)),
        bullets: s.bullets?.map((b) => stripHtml(b)),
      }))

      const updatedLabel = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })

      const page = await LegalPage.findOneAndUpdate(
        { slug },
        {
          $set: {
            slug,
            path: `/${slug}`,
            title: stripHtml(req.body.title),
            eyebrow: stripHtml(req.body.eyebrow || 'Legal'),
            intro: stripHtml(req.body.intro),
            sections,
            published: req.body.published ?? true,
            updatedLabel,
          },
        },
        { upsert: true, new: true },
      )

      await writeAudit({
        actor: req.user,
        action: 'upsert',
        entity: 'legal',
        entityId: slug,
        ipHash: hashIp(getClientIp(req)),
      })

      res.json({ data: page })
    } catch (err) {
      next(err)
    }
  },
)
