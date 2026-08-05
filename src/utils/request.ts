import type { Request } from 'express'

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() || req.ip || 'unknown'
  }
  return req.ip || 'unknown'
}

export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '').trim()
}
