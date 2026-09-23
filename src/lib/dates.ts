// Dates are normalized once at import to ISO "YYYY-MM-DD" strings, then formatted for display
// only through `formatDate`, so every screen shows them the same way. Parsing is done by hand
// (not `new Date(str)`) because browsers disagree on odd formats and time zones can shift a
// date by a day.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const ISO_RX = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/
const NUMERIC_RX = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})(?:\s.*)?$/
const MONTH_FIRST_RX = /^([a-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/i // "Mar 2, 2026"
const DAY_FIRST_RX = /^(\d{1,2})[-\s]([a-z]{3,9})\.?[-\s,]+(\d{4})$/i // "2 Mar 2026", "02-Mar-2026"

function monthFromName(name: string): number {
  return MONTHS.findIndex((m) => m.toLowerCase() === name.slice(0, 3).toLowerCase()) + 1
}

function fullYear(y: string): number {
  return y.length === 2 ? 2000 + Number(y) : Number(y)
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

function iso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * Reads a statement date and returns it as "YYYY-MM-DD", or null if it can't be read with
 * confidence. Slash dates are read US-style (month first) unless the first number can't be a
 * month, e.g. "25/03/2026". Dates without a year return null, since the year can't be guessed.
 */
export function toIsoDate(raw: string): string | null {
  const s = raw.trim()
  let m: RegExpMatchArray | null
  if ((m = s.match(ISO_RX))) return iso(Number(m[1]), Number(m[2]), Number(m[3]))
  if ((m = s.match(NUMERIC_RX))) {
    const a = Number(m[1])
    const b = Number(m[2])
    const y = fullYear(m[3])
    return a > 12 && b <= 12 ? iso(y, b, a) : iso(y, a, b)
  }
  if ((m = s.match(MONTH_FIRST_RX))) return iso(Number(m[3]), monthFromName(m[1]), Number(m[2]))
  if ((m = s.match(DAY_FIRST_RX))) return iso(Number(m[3]), monthFromName(m[2]), Number(m[1]))
  return null
}

/** Normalizes an imported date: ISO when readable, otherwise the original text (never dropped). */
export function normalizeDate(raw: string): string {
  return toIsoDate(raw) ?? raw.trim()
}

/**
 * The one way dates are shown in the app.
 * - "short": "Mar 2" (cards and lists)
 * - "long":  "Mon, Mar 2, 2026" (the investigation view)
 * Unreadable dates are shown as-is; missing ones as "—".
 */
export function formatDate(date: string, style: 'short' | 'long' = 'short'): string {
  if (!date.trim()) return '—'
  const parsed = toIsoDate(date)
  if (!parsed) return date
  const [y, m, d] = parsed.split('-').map(Number)
  const md = `${MONTHS[m - 1]} ${d}`
  if (style === 'short') return md
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${weekday}, ${md}, ${y}`
}
