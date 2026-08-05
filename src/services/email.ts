import nodemailer from 'nodemailer'
import { env } from '../config/env.js'
import { EmailTemplate } from '../models/EmailTemplate.js'
import { SiteSettings } from '../models/SiteSettings.js'
import { logger } from '../utils/logger.js'
import type { LeadDocument } from '../models/Lead.js'

function createTransport() {
  if (!env.SMTP_HOST) return null
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER
      ? {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        }
      : undefined,
  })
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => vars[key] ?? '')
}

export async function sendLeadEmails(lead: LeadDocument): Promise<void> {
  const transport = createTransport()
  if (!transport) {
    logger.warn('SMTP not configured — skipping email notifications')
    return
  }

  const settings = await SiteSettings.findOne({ key: 'default' }).lean()
  const vars: Record<string, string> = {
    name: lead.name,
    email: lead.email,
    company: lead.company || '—',
    need: lead.need,
    message: lead.message,
    sourcePage: lead.sourcePage || '/contact',
  }

  try {
    if (settings?.notificationsEnabled !== false) {
      const adminTpl = await EmailTemplate.findOne({ key: 'lead_admin' }).lean()
      const recipients =
        settings?.notificationEmails?.length
          ? settings.notificationEmails
          : [settings?.contactEmail || 'info@jprtechnosoft.com']

      if (adminTpl) {
        await transport.sendMail({
          from: env.SMTP_FROM,
          to: recipients.join(', '),
          subject: renderTemplate(adminTpl.subject, vars),
          html: renderTemplate(adminTpl.htmlBody, vars),
          replyTo: lead.email,
        })
      }
    }

    if (settings?.autoReplyEnabled !== false) {
      const replyTpl = await EmailTemplate.findOne({ key: 'lead_autoreply' }).lean()
      if (replyTpl) {
        await transport.sendMail({
          from: env.SMTP_FROM,
          to: lead.email,
          subject: renderTemplate(replyTpl.subject, vars),
          html: renderTemplate(replyTpl.htmlBody, vars),
        })
      }
    }
  } catch (err) {
    logger.error({ err }, 'Failed to send lead emails')
  }
}
