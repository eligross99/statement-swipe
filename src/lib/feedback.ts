// Emails to the Statement Swipe team, written in the user's own mail app, so the user sees everything
// and taps Send themselves. The app never sends anything on its own.
// - "Send feedback" adds only the app version and the kind of device.
// - "Help fix this for your bank" adds a statement's masked layout (see src/lib/pdfMask.ts).

import { APP_VERSION, deviceSummary, isInstalled } from './appInfo'

/** Where feedback goes. A placeholder until Eli creates the real address. */
export const FEEDBACK_EMAIL = 'feedback@example.com'

const mailto = (subject: string, body: string) =>
  `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

/** A `mailto:` link that opens a new email with the subject and a few details already filled in. */
export function feedbackMailto(
  device = deviceSummary(navigator.userAgent, navigator.maxTouchPoints, isInstalled()),
  version = APP_VERSION,
): string {
  const body = `\n\n\n---\nThese details help us fix problems. Nothing about your statements is included.\nApp version: ${version}\nDevice: ${device}\n`
  return mailto('Statement Swipe feedback', body)
}

/** A `mailto:` link for an email with a statement's masked layout in it, ready to send. A link can't
 *  attach a file, so the layout goes in the email itself (a real statement's is about 35,000 characters). */
export function layoutMailto(layout: string): string {
  return mailto(
    'Help reading my bank’s statements',
    `Statement Swipe couldn’t read my statement correctly. Its masked layout is below.\n\nMy bank (optional): \n\n---\n${layout}\n`,
  )
}
