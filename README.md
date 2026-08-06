# JPR Backend

Node.js + TypeScript + Express + MongoDB API for the JPR Technosoft website and admin panel.

## Setup

1. Copy `.env.example` to `.env` and set secrets (JWT secrets must be ≥ 32 chars).
2. Start MongoDB locally or set `MONGODB_URI` to Atlas.
3. Install and run:

```bash
npm install
npm run dev
```

API: `http://localhost:4000`  
Health: `GET /api/v1/health`

Seed manually once (super admin, legal pages, settings, email templates):

```bash
npm run seed
```

## Security checklist

- Helmet headers + CSP (production)
- CORS allowlist (`CORS_ORIGINS`) — never `*`
- Rate limits on auth, leads, analytics
- express-mongo-sanitize + hpp → **custom Mongo sanitizer** (Express 5–safe) + hpp
- Zod validation on all inputs
- bcrypt passwords, JWT access + rotating refresh, login lockout
- Contact form honeypot + field length caps
- IP stored as HMAC hash only
- Legal/email HTML sanitized
- MongoDB: enable auth, IP allowlist, least-privilege user; do not expose port publicly
- Prefer HTTPS + Cloudflare WAF in production

## Key routes

Public: `/api/v1/leads`, `/api/v1/analytics/collect`, `/api/v1/legal/:slug`, `/api/v1/settings/public`  
Admin (JWT): `/api/v1/admin/*`, `/api/v1/auth/*`
