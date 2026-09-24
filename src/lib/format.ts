/** Formats a dollar amount with cents and thousands separators, e.g. 1234.5 → "1,234.50". */
export function usd(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** False for the "—" placeholder used when a statement has no categories (every PDF, many CSVs). */
export function hasCategory(cat: string): boolean {
  return !!cat && cat !== '—'
}

/** "1 item", "3 items". */
export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

/** A short random id. Not crypto-grade; only needs to be unique within one session. */
export function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}
