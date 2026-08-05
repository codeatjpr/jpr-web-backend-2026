import sanitizeHtml from 'sanitize-html'

const allowedTags = [
  'p',
  'br',
  'strong',
  'em',
  'ul',
  'ol',
  'li',
  'a',
  'h2',
  'h3',
  'h4',
]

export function sanitizeUserHtml(dirty: string): string {
  return sanitizeHtml(dirty, {
    allowedTags,
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', {
        rel: 'noopener noreferrer',
        target: '_blank',
      }),
    },
  })
}
