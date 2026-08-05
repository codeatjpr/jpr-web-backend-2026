import { env } from '../config/env.js'
import { User } from '../models/User.js'
import { LegalPage } from '../models/LegalPage.js'
import { SiteSettings } from '../models/SiteSettings.js'
import { EmailTemplate } from '../models/EmailTemplate.js'
import { hashPassword } from '../services/auth.js'
import { logger } from '../utils/logger.js'

const defaultLegal = [
  {
    slug: 'privacy' as const,
    path: '/privacy',
    title: 'Privacy Policy',
    eyebrow: 'Legal',
    intro:
      'This Privacy Policy explains how JPR Technosoft collects, uses, and protects information when you visit our website or contact us about product engineering, talent, or training services.',
    updatedLabel: 'July 23, 2026',
    sections: [
      {
        heading: 'Who we are',
        paragraphs: [
          'JPR Technosoft (“we”, “us”) operates this website and provides enterprise product engineering, embedded talent, and training services. For privacy questions, contact us at info@jprtechnosoft.com.',
        ],
      },
      {
        heading: 'Information we collect',
        paragraphs: [
          'We collect information you choose to share and limited technical data needed to operate the site securely.',
        ],
        bullets: [
          'Contact details you submit (name, email, company, message, and engagement preference)',
          'Basic technical logs such as IP address, browser type, device, and pages visited',
          'Optional analytics signals if you consent to non-essential cookies',
        ],
      },
      {
        heading: 'How we use information',
        paragraphs: [
          'We use personal information only for legitimate business purposes related to our services — responding to inquiries, operating the website, improving aggregate experience, and meeting legal obligations.',
        ],
      },
      {
        heading: 'Cookies',
        paragraphs: [
          'Essential cookies keep the site working. Analytics cookies are optional and only set with your consent. See our Cookie Policy for details.',
        ],
      },
      {
        heading: 'Contact',
        paragraphs: ['Questions: info@jprtechnosoft.com'],
      },
    ],
  },
  {
    slug: 'terms' as const,
    path: '/terms',
    title: 'Terms of Service',
    eyebrow: 'Legal',
    intro:
      'These Terms of Service govern your use of the JPR Technosoft website. By accessing the site, you agree to these terms.',
    updatedLabel: 'July 23, 2026',
    sections: [
      {
        heading: 'Website use',
        paragraphs: [
          'This website provides information about our product engineering, talent, and training services. Content is for general information and does not create a client engagement until we agree in writing.',
        ],
      },
      {
        heading: 'Acceptable use',
        paragraphs: [
          'You agree not to misuse the site, attempt unauthorized access, overload our systems, or submit unlawful or harmful content through forms.',
        ],
      },
      {
        heading: 'Limitation of liability',
        paragraphs: [
          'To the fullest extent permitted by law, JPR Technosoft is not liable for indirect or consequential damages arising from use of this website.',
        ],
      },
      {
        heading: 'Contact',
        paragraphs: ['Questions: info@jprtechnosoft.com'],
      },
    ],
  },
  {
    slug: 'cookies' as const,
    path: '/cookies',
    title: 'Cookie Policy',
    eyebrow: 'Legal',
    intro:
      'This Cookie Policy explains how JPR Technosoft uses cookies and similar technologies on this website.',
    updatedLabel: 'July 23, 2026',
    sections: [
      {
        heading: 'What cookies are',
        paragraphs: [
          'Cookies are small text files stored on your device. They help websites remember preferences, keep sessions secure, and understand aggregate traffic patterns.',
        ],
      },
      {
        heading: 'How we use cookies',
        paragraphs: ['We use cookies in these categories:'],
        bullets: [
          'Essential — required for basic site operation and storing your consent choice',
          'Analytics — help us understand anonymized usage if you allow them',
        ],
      },
      {
        heading: 'Your choices',
        paragraphs: [
          'You can control cookies through your browser settings and our on-site consent banner. Blocking essential cookies may affect site functionality.',
        ],
      },
      {
        heading: 'Contact',
        paragraphs: ['Questions about cookies: info@jprtechnosoft.com.'],
      },
    ],
  },
]

export async function ensureSeedData(): Promise<void> {
  const adminCount = await User.countDocuments({ role: 'super_admin' })
  if (adminCount === 0) {
    await User.create({
      email: env.SEED_ADMIN_EMAIL.toLowerCase(),
      name: env.SEED_ADMIN_NAME,
      role: 'super_admin',
      passwordHash: await hashPassword(env.SEED_ADMIN_PASSWORD),
      active: true,
    })
    logger.info(`Seeded super_admin: ${env.SEED_ADMIN_EMAIL}`)
  }

  for (const page of defaultLegal) {
    const exists = await LegalPage.findOne({ slug: page.slug })
    if (!exists) {
      await LegalPage.create({ ...page, published: true })
    }
  }

  const defaultSocialLinks = [
    {
      id: 'linkedin',
      label: 'LinkedIn',
      href: 'https://www.linkedin.com/company/jpr-technosoft',
    },
    { id: 'x', label: 'X', href: 'https://x.com/jprtechnosoft' },
    {
      id: 'github',
      label: 'GitHub',
      href: 'https://github.com/jprtechnosoft',
    },
    {
      id: 'youtube',
      label: 'YouTube',
      href: 'https://www.youtube.com/@jprtechnosoft',
    },
  ]

  const settings = await SiteSettings.findOne({ key: 'default' })
  if (!settings) {
    await SiteSettings.create({
      key: 'default',
      contactEmail: 'info@jprtechnosoft.com',
      phone: '01205106084',
      phoneHref: 'tel:+911205106084',
      socialLinks: defaultSocialLinks,
      notificationEmails: ['info@jprtechnosoft.com'],
      autoReplyEnabled: true,
      notificationsEnabled: true,
    })
  } else if (!settings.socialLinks || settings.socialLinks.length < defaultSocialLinks.length) {
    await SiteSettings.updateOne(
      { key: 'default' },
      { $set: { socialLinks: defaultSocialLinks } },
    )
    logger.info('Updated site settings social links to full default set')
  }

  const adminTpl = await EmailTemplate.findOne({ key: 'lead_admin' })
  if (!adminTpl) {
    await EmailTemplate.create({
      key: 'lead_admin',
      subject: 'New JPR inquiry — {{need}} — {{company}}',
      htmlBody: `<p><strong>New website inquiry</strong></p>
<p>Name: {{name}}<br/>Email: {{email}}<br/>Company: {{company}}<br/>Need: {{need}}</p>
<p>Message:</p>
<p>{{message}}</p>
<p>Source: {{sourcePage}}</p>`,
    })
  }

  const replyTpl = await EmailTemplate.findOne({ key: 'lead_autoreply' })
  if (!replyTpl) {
    await EmailTemplate.create({
      key: 'lead_autoreply',
      subject: 'We received your note — JPR Technosoft',
      htmlBody: `<p>Hi {{name}},</p>
<p>Thank you for contacting JPR Technosoft. We received your inquiry about <strong>{{need}}</strong> and aim to reply within one business day with a recommended next step.</p>
<p>— JPR Technosoft</p>`,
    })
  }
}
