import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import hpp from 'hpp'
import pinoHttp from 'pino-http'
import type { IncomingMessage } from 'node:http'
import { env } from './config/env.js'
import { logger } from './utils/logger.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'
import { generalLimiter } from './middleware/rateLimit.js'
import { sanitizeMongoInput } from './middleware/sanitizeMongo.js'
import { authRouter } from './modules/auth/routes.js'
import { usersRouter } from './modules/users/routes.js'
import { publicLeadsRouter, adminLeadsRouter } from './modules/leads/routes.js'
import {
  publicAnalyticsRouter,
  adminAnalyticsRouter,
} from './modules/analytics/routes.js'
import { publicLegalRouter, adminLegalRouter } from './modules/legal/routes.js'
import {
  publicSettingsRouter,
  adminSettingsRouter,
} from './modules/settings/routes.js'

export function createApp() {
  const app = express()

  app.set('trust proxy', 1)

  app.use(
    helmet({
      contentSecurityPolicy: env.isProd
        ? {
            directives: {
              defaultSrc: ["'self'"],
              connectSrc: ["'self'", ...env.corsOrigins],
              imgSrc: ["'self'", 'data:', 'https:'],
              styleSrc: ["'self'", "'unsafe-inline'"],
              scriptSrc: ["'self'"],
              frameAncestors: ["'none'"],
            },
          }
        : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  )

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.corsOrigins.includes(origin)) {
          callback(null, true)
          return
        }
        callback(new Error('Not allowed by CORS'))
      },
      credentials: true,
    }),
  )

  app.use(express.json({ limit: '100kb' }))
  app.use(express.text({ type: ['text/plain', 'text/*'], limit: '100kb' }))
  app.use(express.urlencoded({ extended: false, limit: '100kb' }))
  // Allow sendBeacon (text/plain) payloads for analytics
  app.use((req, _res, next) => {
    if (typeof req.body === 'string' && req.body.trim().startsWith('{')) {
      try {
        req.body = JSON.parse(req.body)
      } catch {
        // leave as-is; validators will reject
      }
    }
    next()
  })
  app.use(cookieParser())
  app.use(hpp())
  app.use(sanitizeMongoInput)
  app.use(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pinoHttp as unknown as (opts: object) => import('express').RequestHandler)({
      logger,
      autoLogging: {
        ignore: (req: IncomingMessage) => (req.url || '') === '/api/v1/health',
      },
    }),
  )
  app.use(generalLimiter)

  app.get('/api/v1/health', (_req, res) => {
    res.json({
      data: {
        ok: true,
        service: 'jpr-backend',
        env: env.NODE_ENV,
        time: new Date().toISOString(),
      },
    })
  })

  app.use('/api/v1/auth', authRouter)
  app.use('/api/v1/leads', publicLeadsRouter)
  app.use('/api/v1/analytics', publicAnalyticsRouter)
  app.use('/api/v1/legal', publicLegalRouter)
  app.use('/api/v1/settings', publicSettingsRouter)

  app.use('/api/v1/admin/users', usersRouter)
  app.use('/api/v1/admin/leads', adminLeadsRouter)
  app.use('/api/v1/admin/analytics', adminAnalyticsRouter)
  app.use('/api/v1/admin/legal', adminLegalRouter)
  app.use('/api/v1/admin/settings', adminSettingsRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
