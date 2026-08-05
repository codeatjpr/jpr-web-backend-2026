import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireRoles } from '../../middleware/auth.js'
import { validate } from '../../middleware/validate.js'
import { User, USER_ROLES } from '../../models/User.js'
import { hashPassword } from '../../services/auth.js'
import { writeAudit } from '../../services/audit.js'
import { hashIp } from '../../utils/crypto.js'
import { getClientIp } from '../../utils/request.js'
import { AppError } from '../../utils/errors.js'

const createUserSchema = z.object({
  email: z.string().email().max(254),
  name: z.string().min(2).max(120),
  password: z.string().min(12).max(128),
  role: z.enum(USER_ROLES),
})

const updateUserSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  role: z.enum(USER_ROLES).optional(),
  active: z.boolean().optional(),
  password: z.string().min(12).max(128).optional(),
})

export const usersRouter = Router()

usersRouter.use(requireAuth, requireRoles('super_admin'))

usersRouter.get('/', async (_req, res, next) => {
  try {
    const users = await User.find()
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .lean()
    res.json({ data: users })
  } catch (err) {
    next(err)
  }
})

usersRouter.post('/', validate({ body: createUserSchema }), async (req, res, next) => {
  try {
    const exists = await User.findOne({ email: req.body.email.toLowerCase() })
    if (exists) throw new AppError(409, 'Email already in use', 'CONFLICT')

    const user = await User.create({
      email: req.body.email.toLowerCase(),
      name: req.body.name,
      role: req.body.role,
      passwordHash: await hashPassword(req.body.password),
    })

    await writeAudit({
      actor: req.user,
      action: 'create',
      entity: 'user',
      entityId: String(user._id),
      diff: { email: user.email, role: user.role },
      ipHash: hashIp(getClientIp(req)),
    })

    res.status(201).json({
      data: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        active: user.active,
      },
    })
  } catch (err) {
    next(err)
  }
})

usersRouter.patch(
  '/:id',
  validate({
    params: z.object({ id: z.string().min(1) }),
    body: updateUserSchema,
  }),
  async (req, res, next) => {
    try {
      const user = await User.findById(req.params.id)
      if (!user) throw new AppError(404, 'User not found', 'NOT_FOUND')

      if (req.body.name !== undefined) user.name = req.body.name
      if (req.body.role !== undefined) user.role = req.body.role
      if (req.body.active !== undefined) user.active = req.body.active
      if (req.body.password) user.passwordHash = await hashPassword(req.body.password)
      await user.save()

      await writeAudit({
        actor: req.user,
        action: 'update',
        entity: 'user',
        entityId: String(user._id),
        diff: req.body,
        ipHash: hashIp(getClientIp(req)),
      })

      res.json({
        data: {
          _id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          active: user.active,
        },
      })
    } catch (err) {
      next(err)
    }
  },
)
