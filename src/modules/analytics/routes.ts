import { Router } from 'express'
import geoip from 'geoip-lite'
import { UAParser } from 'ua-parser-js'
import { z } from 'zod'
import { requireAuth, requireRoles } from '../../middleware/auth.js'
import { analyticsLimiter } from '../../middleware/rateLimit.js'
import { validate } from '../../middleware/validate.js'
import {
  AnalyticsEvent,
  ANALYTICS_EVENT_TYPES,
} from '../../models/AnalyticsEvent.js'
import { Lead } from '../../models/Lead.js'
import { hashIp } from '../../utils/crypto.js'
import { getClientIp } from '../../utils/request.js'

const eventSchema = z.object({
  type: z.enum(ANALYTICS_EVENT_TYPES),
  path: z
    .string()
    .min(1)
    .max(300)
    .regex(/^\//, 'Path must start with /'),
  title: z.string().max(300).optional(),
  referrer: z.string().max(500).optional(),
  visitorId: z.string().min(8).max(80),
  sessionId: z.string().min(8).max(80),
  language: z.string().max(40).optional(),
  screenWidth: z.number().int().min(0).max(10000).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
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

const collectSchema = z.object({
  events: z.array(eventSchema).min(1).max(20),
})

function deviceFromUa(ua: string): 'mobile' | 'desktop' | 'tablet' | 'unknown' {
  const parser = new UAParser(ua)
  const type = parser.getDevice().type
  if (type === 'mobile') return 'mobile'
  if (type === 'tablet') return 'tablet'
  if (!type) return 'desktop'
  return 'unknown'
}

function classifySource(referrer?: string, utmSource?: string): string {
  if (utmSource) return utmSource.toLowerCase()
  if (!referrer) return 'direct'
  try {
    const host = new URL(referrer).hostname.toLowerCase()
    if (host.includes('google.')) return 'google'
    if (host.includes('linkedin.')) return 'linkedin'
    if (host.includes('bing.')) return 'bing'
    if (host.includes('twitter.') || host.includes('x.com')) return 'twitter'
    return host
  } catch {
    return 'other'
  }
}

function parseRange(query: Record<string, unknown>): { from: Date; to: Date } {
  const now = new Date()
  const to = query.to ? new Date(String(query.to)) : now
  let from: Date
  if (query.from) {
    from = new Date(String(query.from))
  } else {
    const range = String(query.range || '7d')
    const days = range === 'today' ? 0 : range === '30d' ? 30 : 7
    from = new Date(to)
    if (days === 0) {
      from.setUTCHours(0, 0, 0, 0)
    } else {
      from.setUTCDate(from.getUTCDate() - days)
    }
  }
  return { from, to }
}

export const publicAnalyticsRouter = Router()
export const adminAnalyticsRouter = Router()

publicAnalyticsRouter.post(
  '/collect',
  analyticsLimiter,
  validate({ body: collectSchema }),
  async (req, res, next) => {
    try {
      const ua = String(req.headers['user-agent'] || '')
      const ip = getClientIp(req)
      const geo = geoip.lookup(ip)
      const parser = new UAParser(ua)
      const device = deviceFromUa(ua)
      const browser = parser.getBrowser().name || 'unknown'
      const os = parser.getOS().name || 'unknown'
      const country = geo?.country || 'Unknown'
      const ipHash = hashIp(ip)

      const docs = req.body.events.map(
        (event: z.infer<typeof eventSchema>) => ({
          type: event.type,
          path: event.path,
          title: event.title,
          referrer: event.referrer,
          utm: event.utm,
          visitorId: event.visitorId,
          sessionId: event.sessionId,
          device,
          browser,
          os,
          country,
          language: event.language,
          screenWidth: event.screenWidth,
          meta: event.meta,
          ipHash,
        }),
      )

      await AnalyticsEvent.insertMany(docs, { ordered: false })
      res.status(204).send()
    } catch (err) {
      next(err)
    }
  },
)

adminAnalyticsRouter.use(requireAuth, requireRoles('super_admin', 'editor', 'viewer'))

adminAnalyticsRouter.get('/overview', async (req, res, next) => {
  try {
    const { from, to } = parseRange(req.query as Record<string, unknown>)
    const match = { createdAt: { $gte: from, $lte: to } }

    const [
      pageViews,
      uniqueVisitors,
      sessions,
      submissions,
      topPages,
      devices,
      countries,
      sourcesRaw,
      timeseries,
      needMix,
    ] = await Promise.all([
      AnalyticsEvent.countDocuments({ ...match, type: 'page_view' }),
      AnalyticsEvent.distinct('visitorId', match).then((v) => v.length),
      AnalyticsEvent.distinct('sessionId', match).then((v) => v.length),
      Lead.countDocuments({ createdAt: { $gte: from, $lte: to } }),
      AnalyticsEvent.aggregate([
        { $match: { ...match, type: 'page_view' } },
        { $group: { _id: '$path', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      AnalyticsEvent.aggregate([
        { $match: { ...match, type: 'page_view' } },
        { $group: { _id: '$device', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      AnalyticsEvent.aggregate([
        { $match: { ...match, type: 'page_view' } },
        { $group: { _id: '$country', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      AnalyticsEvent.find({ ...match, type: 'page_view' })
        .select('referrer utm')
        .limit(5000)
        .lean(),
      AnalyticsEvent.aggregate([
        { $match: { ...match, type: 'page_view' } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            pageViews: { $sum: 1 },
            visitors: { $addToSet: '$sessionId' },
            uniqueVisitors: { $addToSet: '$visitorId' },
          },
        },
        {
          $project: {
            date: '$_id',
            pageViews: 1,
            visitors: { $size: '$visitors' },
            uniqueVisitors: { $size: '$uniqueVisitors' },
          },
        },
        { $sort: { date: 1 } },
      ]),
      Lead.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        { $group: { _id: '$need', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ])

    const sourceCounts = new Map<string, number>()
    for (const row of sourcesRaw) {
      const name = classifySource(row.referrer || undefined, row.utm?.source || undefined)
      sourceCounts.set(name, (sourceCounts.get(name) || 0) + 1)
    }
    const sources = [...sourceCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const contactViews = await AnalyticsEvent.countDocuments({
      ...match,
      type: 'page_view',
      path: '/contact',
    })
    const formStarts = await AnalyticsEvent.countDocuments({
      ...match,
      type: 'form_start',
    })
    const formSubmits = await AnalyticsEvent.countDocuments({
      ...match,
      type: 'form_submit',
    })

    const bounceSessions = await AnalyticsEvent.aggregate([
      { $match: { ...match, type: 'page_view' } },
      { $group: { _id: '$sessionId', views: { $sum: 1 } } },
      { $match: { views: 1 } },
      { $count: 'bounces' },
    ])
    const bounces = bounceSessions[0]?.bounces || 0
    const bounceRate = sessions > 0 ? Math.round((bounces / sessions) * 1000) / 10 : 0
    const conversionRate =
      sessions > 0 ? Math.round((submissions / sessions) * 1000) / 10 : 0

    res.json({
      data: {
        range: { from, to },
        kpis: {
          visitors: sessions,
          uniqueVisitors,
          pageViews,
          submissions,
          bounceRate,
          conversionRate,
        },
        topPages: topPages.map((p) => ({ name: p._id, count: p.count })),
        devices: devices.map((d) => ({ name: d._id || 'unknown', count: d.count })),
        countries: countries.map((c) => ({ name: c._id || 'Unknown', count: c.count })),
        sources,
        timeseries,
        needMix: needMix.map((n) => ({ name: n._id, count: n.count })),
        funnel: {
          contactViews,
          formStarts,
          formSubmits,
          submissions,
        },
      },
    })
  } catch (err) {
    next(err)
  }
})
