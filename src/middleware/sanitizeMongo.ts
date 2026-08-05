import type { NextFunction, Request, Response } from 'express'

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue)
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (key.startsWith('$') || key.includes('.')) continue
      out[key] = sanitizeValue(nested)
    }
    return out
  }
  return value
}

/** Express 5–safe Mongo operator injection filter (body + params only). */
export function sanitizeMongoInput(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body)
  }
  if (req.params && typeof req.params === 'object') {
    const cleaned = sanitizeValue(req.params) as Record<string, string>
    for (const key of Object.keys(req.params)) {
      delete (req.params as Record<string, string>)[key]
    }
    Object.assign(req.params, cleaned)
  }
  next()
}
