import crypto from 'node:crypto'
import { env } from '../config/env.js'

export function hashIp(ip: string | undefined): string {
  const value = (ip || 'unknown').trim()
  return crypto.createHmac('sha256', env.IP_HASH_SALT).update(value).digest('hex')
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function randomToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString('hex')
}
