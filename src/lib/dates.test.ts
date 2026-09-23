import { formatDate, normalizeDate, toIsoDate } from './dates'

describe('toIsoDate', () => {
  it('reads ISO dates, with or without a time part', () => {
    expect(toIsoDate('2026-03-02')).toBe('2026-03-02')
    expect(toIsoDate('2026/3/2')).toBe('2026-03-02')
    expect(toIsoDate('2026-03-02T14:05:00Z')).toBe('2026-03-02')
  })

  it('reads US slash dates month-first', () => {
    expect(toIsoDate('03/02/2026')).toBe('2026-03-02')
    expect(toIsoDate('3/2/26')).toBe('2026-03-02')
    expect(toIsoDate('03-02-2026')).toBe('2026-03-02')
  })

  it('reads day-first when the first number cannot be a month', () => {
    expect(toIsoDate('25/03/2026')).toBe('2026-03-25')
  })

  it('reads dates with month names', () => {
    expect(toIsoDate('Mar 2, 2026')).toBe('2026-03-02')
    expect(toIsoDate('March 2 2026')).toBe('2026-03-02')
    expect(toIsoDate('2 Mar 2026')).toBe('2026-03-02')
    expect(toIsoDate('02-Mar-2026')).toBe('2026-03-02')
  })

  it('rejects impossible or year-less dates', () => {
    expect(toIsoDate('02/30/2026')).toBeNull()
    expect(toIsoDate('2026-13-01')).toBeNull()
    expect(toIsoDate('Mar 03')).toBeNull()
    expect(toIsoDate('')).toBeNull()
    expect(toIsoDate('pending')).toBeNull()
  })

  it('knows about leap years', () => {
    expect(toIsoDate('02/29/2028')).toBe('2028-02-29')
    expect(toIsoDate('02/29/2026')).toBeNull()
  })
})

describe('normalizeDate', () => {
  it('keeps unreadable text rather than dropping it', () => {
    expect(normalizeDate(' 03/02/2026 ')).toBe('2026-03-02')
    expect(normalizeDate(' Mar 03 ')).toBe('Mar 03')
  })
})

describe('formatDate', () => {
  it('shows a short date for cards and lists', () => {
    expect(formatDate('2026-03-02')).toBe('Mar 2')
  })

  it('shows a long date with the weekday and year', () => {
    expect(formatDate('2026-03-02', 'long')).toBe('Mon, Mar 2, 2026')
  })

  it('formats dates saved before import normalized them', () => {
    expect(formatDate('03/02/2026')).toBe('Mar 2')
  })

  it('falls back gracefully', () => {
    expect(formatDate('')).toBe('—')
    expect(formatDate('Mar 03')).toBe('Mar 03')
  })
})
