import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { User, type UserRole } from '../models/User.js'
import { AppError } from '../utils/errors.js'

export type AuthUser = {
  id: string
  email: string
  name: string
  role: UserRole
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

type AccessPayload = {
  sub: string
  email: string
  role: UserRole
  name: string
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) return header.slice(7)
  const cookie = req.cookies?.jpr_access as string | undefined
  return cookie || null
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractToken(req)
    if (!token) throw new AppError(401, 'Authentication required', 'UNAUTHORIZED')

    let payload: AccessPayload
    try {
      payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload
    } catch {
      throw new AppError(401, 'Invalid or expired token', 'UNAUTHORIZED')
    }

    const user = await User.findById(payload.sub).lean()
    if (!user || !user.active) {
      throw new AppError(401, 'Account inactive or not found', 'UNAUTHORIZED')
    }

    req.user = {
      id: String(user._id),
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
    }
    next()
  } catch (err) {
    next(err)
  }
}

export function requireRoles(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new AppError(401, 'Authentication required', 'UNAUTHORIZED'))
      return
    }
    if (!roles.includes(req.user.role)) {
      next(new AppError(403, 'Insufficient permissions', 'FORBIDDEN'))
      return
    }
    next()
  }
}
