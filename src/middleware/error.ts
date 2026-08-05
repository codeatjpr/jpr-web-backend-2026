import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'
import { AppError } from '../utils/errors.js'
import { logger } from '../utils/logger.js'
import { env } from '../config/env.js'

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } })
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        message: err.message,
        code: err.code,
        details: err.details,
      },
    })
    return
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: err.flatten(),
      },
    })
    return
  }

  logger.error({ err }, 'Unhandled error')
  res.status(500).json({
    error: {
      message: env.isProd ? 'Internal server error' : (err as Error)?.message || 'Error',
      code: 'INTERNAL_ERROR',
    },
  })
}
