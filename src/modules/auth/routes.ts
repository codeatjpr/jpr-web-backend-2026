import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../../middleware/auth.js'
import { authLimiter } from '../../middleware/rateLimit.js'
import { validate } from '../../middleware/validate.js'
import { User } from '../../models/User.js'
import {
  clearAuthCookies,
  hashPassword,
  loginUser,
  refreshSession,
  revokeRefreshToken,
  setAuthCookies,
} from '../../services/auth.js'
import { writeAudit } from '../../services/audit.js'
import { hashIp } from '../../utils/crypto.js'
import { getClientIp } from '../../utils/request.js'
import { AppError } from '../../utils/errors.js'

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(8).max(128),
  newPassword: z
    .string()
    .min(12)
    .max(128)
    .regex(/[A-Z]/, 'Must include uppercase')
    .regex(/[a-z]/, 'Must include lowercase')
    .regex(/[0-9]/, 'Must include a number'),
})

export const authRouter = Router()

authRouter.post(
  '/login',
  authLimiter,
  validate({ body: loginSchema }),
  async (req, res, next) => {
    try {
      const ipHash = hashIp(getClientIp(req))
      const result = await loginUser({
        email: req.body.email,
        password: req.body.password,
        userAgent: req.headers['user-agent'],
        ipHash,
      })
      setAuthCookies(res, result.accessToken, result.refreshToken)
      await writeAudit({
        actor: result.user,
        action: 'login',
        entity: 'auth',
        entityId: result.user.id,
        ipHash,
      })
      res.json({
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      })
    } catch (err) {
      next(err)
    }
  },
)

authRouter.post('/refresh', authLimiter, async (req, res, next) => {
  try {
    const raw =
      (req.cookies?.jpr_refresh as string | undefined) ||
      (typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : undefined)
    if (!raw) throw new AppError(401, 'Refresh token required', 'UNAUTHORIZED')

    const ipHash = hashIp(getClientIp(req))
    const result = await refreshSession(raw, {
      userAgent: req.headers['user-agent'],
      ipHash,
    })
    setAuthCookies(res, result.accessToken, result.refreshToken)
    res.json({
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    })
  } catch (err) {
    next(err)
  }
})

authRouter.post('/logout', async (req, res, next) => {
  try {
    const raw = req.cookies?.jpr_refresh as string | undefined
    await revokeRefreshToken(raw)
    clearAuthCookies(res)
    res.json({ data: { ok: true } })
  } catch (err) {
    next(err)
  }
})

authRouter.get('/me', requireAuth, async (req, res) => {
  res.json({ data: { user: req.user } })
})

authRouter.post(
  '/change-password',
  requireAuth,
  validate({ body: changePasswordSchema }),
  async (req, res, next) => {
    try {
      const user = await User.findById(req.user!.id)
      if (!user) throw new AppError(404, 'User not found', 'NOT_FOUND')

      const bcrypt = await import('bcryptjs')
      const ok = await bcrypt.compare(req.body.currentPassword, user.passwordHash)
      if (!ok) throw new AppError(400, 'Current password is incorrect', 'BAD_REQUEST')

      user.passwordHash = await hashPassword(req.body.newPassword)
      await user.save()

      await writeAudit({
        actor: req.user,
        action: 'change_password',
        entity: 'user',
        entityId: req.user!.id,
        ipHash: hashIp(getClientIp(req)),
      })

      res.json({ data: { ok: true } })
    } catch (err) {
      next(err)
    }
  },
)
