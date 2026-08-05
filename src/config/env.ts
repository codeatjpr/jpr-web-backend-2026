import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('24h'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  IP_HASH_SALT: z.string().min(8),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  COOKIE_SECURE: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  SEED_ADMIN_EMAIL: z.string().email().default('admin@jprtechnosoft.com'),
  SEED_ADMIN_PASSWORD: z.string().min(12).default('ChangeMeAdmin123!'),
  SEED_ADMIN_NAME: z.string().default('JPR Admin'),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_FROM: z.string().default('JPR Technosoft <info@jprtechnosoft.com>'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
  isProd: parsed.data.NODE_ENV === 'production',
}
