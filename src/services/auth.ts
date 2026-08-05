import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import type { Response } from 'express'
import { env } from '../config/env.js'
import { RefreshToken } from '../models/RefreshToken.js'
import { User, type UserRole } from '../models/User.js'
import { hashToken, randomToken } from '../utils/crypto.js'
import { AppError } from '../utils/errors.js'

const MAX_FAILED = 8
const LOCK_MS = 15 * 60 * 1000
const BCRYPT_ROUNDS = 12

function parseTtlToMs(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl)
  if (!match) return 7 * 24 * 60 * 60 * 1000
  const n = Number(match[1])
  const unit = match[2]
  const mult = unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000
  return n * mult
}

export function signAccessToken(user: {
  id: string
  email: string
  name: string
  role: UserRole
}): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'] },
  )
}

export async function issueRefreshToken(input: {
  userId: string
  userAgent?: string
  ipHash?: string
}): Promise<string> {
  const raw = randomToken(48)
  const tokenHash = hashToken(raw)
  const expiresAt = new Date(Date.now() + parseTtlToMs(env.JWT_REFRESH_TTL))
  await RefreshToken.create({
    userId: input.userId,
    tokenHash,
    expiresAt,
    userAgent: input.userAgent,
    ipHash: input.ipHash,
  })
  return raw
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  const common = {
    httpOnly: true,
    secure: env.COOKIE_SECURE || env.isProd,
    sameSite: 'lax' as const,
    path: '/',
  }
  res.cookie('jpr_access', accessToken, {
    ...common,
    maxAge: parseTtlToMs(env.JWT_ACCESS_TTL),
  })
  res.cookie('jpr_refresh', refreshToken, {
    ...common,
    maxAge: parseTtlToMs(env.JWT_REFRESH_TTL),
    path: '/api/v1/auth',
  })
}

export function clearAuthCookies(res: Response) {
  res.clearCookie('jpr_access', { path: '/' })
  res.clearCookie('jpr_refresh', { path: '/api/v1/auth' })
}

export async function loginUser(input: {
  email: string
  password: string
  userAgent?: string
  ipHash?: string
}) {
  const user = await User.findOne({ email: input.email.toLowerCase().trim() })
  if (!user || !user.active) {
    throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS')
  }

  if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
    throw new AppError(423, 'Account temporarily locked. Try again later.', 'LOCKED')
  }

  const ok = await bcrypt.compare(input.password, user.passwordHash)
  if (!ok) {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1
    if (user.failedLoginAttempts >= MAX_FAILED) {
      user.lockUntil = new Date(Date.now() + LOCK_MS)
      user.failedLoginAttempts = 0
    }
    await user.save()
    throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS')
  }

  user.failedLoginAttempts = 0
  user.lockUntil = undefined
  user.lastLoginAt = new Date()
  await user.save()

  const authUser = {
    id: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role as UserRole,
  }

  const accessToken = signAccessToken(authUser)
  const refreshToken = await issueRefreshToken({
    userId: authUser.id,
    userAgent: input.userAgent,
    ipHash: input.ipHash,
  })

  return { user: authUser, accessToken, refreshToken }
}

export async function refreshSession(rawRefresh: string, meta: { userAgent?: string; ipHash?: string }) {
  const tokenHash = hashToken(rawRefresh)
  const stored = await RefreshToken.findOne({ tokenHash })
  if (!stored || stored.revokedAt || stored.expiresAt.getTime() < Date.now()) {
    throw new AppError(401, 'Invalid refresh token', 'UNAUTHORIZED')
  }

  stored.revokedAt = new Date()
  await stored.save()

  const user = await User.findById(stored.userId)
  if (!user || !user.active) {
    throw new AppError(401, 'Account inactive', 'UNAUTHORIZED')
  }

  const authUser = {
    id: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role as UserRole,
  }

  const accessToken = signAccessToken(authUser)
  const refreshToken = await issueRefreshToken({
    userId: authUser.id,
    userAgent: meta.userAgent,
    ipHash: meta.ipHash,
  })

  return { user: authUser, accessToken, refreshToken }
}

export async function revokeRefreshToken(rawRefresh: string | undefined) {
  if (!rawRefresh) return
  const tokenHash = hashToken(rawRefresh)
  await RefreshToken.updateOne({ tokenHash }, { $set: { revokedAt: new Date() } })
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}
