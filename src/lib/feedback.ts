// "Send feedback": an email to the Statement Swipe team, written in the user's own mail app. The app
// adds only its version and the kind of device, never anything about statements or purchases.

import { APP_VERSION, deviceSummary, isInstalled } from './appInfo'

/** Where feedback goes. A placeholder until Eli creates the real address. */
export const FEEDBACK_EMAIL = 'feedback@example.com'

/** A `mailto:` link that opens a new email with the subject and a few details already filled in. */
export function feedbackMailto(
  device = deviceSummary(navigator.userAgent, navigator.maxTouchPoints, isInstalled()),
  version = APP_VERSION,
): string {
  const body = `\n\n\n---\nThese details help us fix problems. Nothing about your statements is included.\nApp version: ${version}\nDevice: ${device}\n`
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('Statement Swipe feedback')}&body=${encodeURIComponent(body)}`
}
