// "Search the web" in Look closer: opens Google with a purchase's merchant name, and nothing else.
// This is the one exception in the privacy rules (CLAUDE.md): only the merchant name, and only when
// the user taps. Never amounts, dates, notes, or anything automatic.

/** Payment services that put their own code before the shop's name: "SQ *DD BAR" is DD Bar, paid through Square. */
const PROCESSOR_PREFIX = /^(?:SQ|TST|SP|PP|PAYPAL|PY)\s?\*\s*/i
/** Store numbers and references: a run of 4 or more digits, like the "574123900" in "SHELL OIL 574123900". */
const STORE_NUMBER = /^#?\d{4,}$/
/** A reference code glued on with an asterisk, like the "*2K4AB1CD2" in "AMZN MKTP US*2K4AB1CD2". */
const STAR_REFERENCE = /\*[A-Z0-9]*\d[A-Z0-9]*/gi

/** The statement text tidied into something worth searching for: no payment-service code, store
 *  numbers, or reference codes. Falls back to the original text if nothing would be left. */
export function merchantQuery(desc: string): string {
  const words = desc
    .replace(PROCESSOR_PREFIX, '')
    .replace(STAR_REFERENCE, ' ')
    .split(/\s+/)
    .filter((w) => w && !STORE_NUMBER.test(w))
  const query = words.join(' ').replace(/^[\s*#-]+|[\s*#-]+$/g, '')
  return query || desc.trim()
}

/** The Google search for a purchase's merchant name. */
export function webSearchUrl(desc: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(merchantQuery(desc))}`
}
