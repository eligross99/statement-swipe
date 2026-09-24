import { sampleStatementPages } from '../test/statementFixture'
import { toLines, type Line } from './pdfLines'
import { findClosingDate, parseStatement } from './statementPdf'

/** Lines as the PDF reader would give them for the synthetic statement. */
function sampleLines(): Line[] {
  return sampleStatementPages().flatMap((texts, i) =>
    toLines(
      texts.map((t) => ({ str: t.text, x: t.x, y: t.y, size: t.size ?? 9, width: t.text.length * (t.size ?? 9) * 0.5 })),
      i + 1,
    ),
  )
}

/** A line from cells, spaced like columns. */
function line(...cells: string[]): Line {
  return { page: 1, y: 0, cells: cells.map((text, i) => ({ x: 40 + i * 100, text })), text: cells.join(' ') }
}

describe('parseStatement', () => {
  it('finds the purchases, skipping payments, credits, and zero interest', () => {
    const { purchases, skipped } = parseStatement(sampleLines())
    expect(purchases).toEqual([
      { desc: 'FAKE COFFEE CO #12 OAKLAND CA', amount: 4.75, date: '2026-06-15', cat: '' },
      { desc: 'SAMPLE GROCERY 0042 BERKELEY CA', amount: 86.2, date: '2026-06-28', cat: '' },
      { desc: 'SQ *EXAMPLE BAR SAN FRANCISCO CA', amount: 42, date: '2026-07-02', cat: '' },
      { desc: 'EXAMPLE AIRLINES 0061234567890', amount: 947, date: '2026-07-10', cat: '' },
    ])
    expect(skipped).toBe(2)
  })

  it('checks what it found against the purchases total printed on the statement', () => {
    expect(parseStatement(sampleLines()).check).toEqual({ printed: 1079.95, found: 1079.95 })
  })

  it('reports a mismatch when a purchase is missing', () => {
    const lines = sampleLines().filter((l) => !l.text.includes('EXAMPLE BAR'))
    expect(parseStatement(lines).check).toEqual({ printed: 1079.95, found: 1037.95 })
  })

  it('uses the summary’s purchases total when the transaction list has none, even with a column after it', () => {
    const lines = sampleLines().filter((l) => !/^TOTAL PURCHASES/.test(l.text))
    expect(parseStatement(lines).check).toEqual({ printed: 1079.95, found: 1079.95 })
  })

  it('ignores section names inside fine print', () => {
    const { purchases } = parseStatement([
      line('Purchases and Adjustments'),
      line('03/02', 'COFFEE', '4.75'),
      line('Your balance includes new Purchases and fees, minus any payments and credits.'),
      line('03/03', 'BAKERY', '8.00'),
    ])
    expect(purchases.map((p) => p.desc)).toEqual(['COFFEE', 'BAKERY'])
  })

  it('has no check when the statement prints no purchases total', () => {
    expect(parseStatement([line('03/02', 'COFFEE', '4.75')]).check).toBeNull()
  })

  it('puts dates from a December–January statement in the right year', () => {
    const { purchases } = parseStatement([
      line('Statement Closing Date', '01/13/2027'),
      line('12/20', 'GIFT SHOP', '30.00'),
      line('01/05', 'BAKERY', '8.00'),
    ])
    expect(purchases.map((p) => p.date)).toEqual(['2026-12-20', '2027-01-05'])
  })

  it('reads dates with years and month names', () => {
    const { purchases } = parseStatement([
      line('03/02/26', 'COFFEE', '4.75'),
      line('Statement period', 'Feb 14, 2026 - Mar 13, 2026'),
      line('Mar 4', 'Mar 5', 'BAKERY', '$8.00'),
    ])
    expect(purchases.map((p) => [p.desc, p.date])).toEqual([
      ['COFFEE', '2026-03-02'],
      ['BAKERY', '2026-03-04'],
    ])
  })

  it('treats minus signs, parentheses, CR, and trailing minus as credits', () => {
    const { purchases, skipped } = parseStatement([
      line('03/02', 'REFUND A', '-4.75'),
      line('03/02', 'REFUND B', '(4.75)'),
      line('03/02', 'REFUND C', '4.75 CR'),
      line('03/02', 'REFUND D', '4.75-'),
      line('03/03', 'COFFEE', '$1,204.75'),
    ])
    expect(purchases.map((p) => [p.desc, p.amount])).toEqual([['COFFEE', 1204.75]])
    expect(skipped).toBe(4)
  })

  it('ignores lines that only look like rows', () => {
    const { purchases } = parseStatement([
      line('03/02', 'Minimum payment due'), // no amount
      line('Balance', '4.75'), // no date
      line('03/02', '1234', '4.75'), // no description
    ])
    expect(purchases).toEqual([])
  })
})

describe('findClosingDate', () => {
  it('uses the end of a "June 14 - July 13, 2026" statement period', () => {
    expect(findClosingDate([line('Billing period: June 14 - July 13, 2026')])).toBe('2026-07-13')
  })

  it('ignores dates on lines unrelated to the statement period', () => {
    expect(findClosingDate([line('Promotional rate ends 03/01/2028')])).toBeNull()
  })
})
