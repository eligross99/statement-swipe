import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  detectColumns,
  detectNegativePurchases,
  findHeaderRow,
  parseAmount,
  parseGrid,
  toPurchases,
  toTable,
  toTransactions,
  type CsvRow,
} from './csv'

const NO_MAP = { desc: '', amount: '', date: '', category: '' }

function fixtureGrid(name: string) {
  return parseGrid(readFileSync(resolve(process.cwd(), 'tests/fixtures', name), 'utf8'))
}

describe('parseAmount', () => {
  it('handles dollar signs, commas, and negatives', () => {
    expect(parseAmount('$1,234.50')).toBe(1234.5)
    expect(parseAmount('-12.00')).toBe(-12)
    expect(parseAmount('$-2.50')).toBe(-2.5)
  })

  it('reads accounting-style parentheses as negative', () => {
    expect(parseAmount('(12.50)')).toBe(-12.5)
    expect(parseAmount('($1,000.00)')).toBe(-1000)
  })

  it('returns NaN for blanks and junk', () => {
    expect(parseAmount('')).toBeNaN()
    expect(parseAmount(undefined)).toBeNaN()
    expect(parseAmount('n/a')).toBeNaN()
  })
})

describe('detectColumns', () => {
  it('guesses description, amount, date, and category by name', () => {
    expect(detectColumns(['Post Date', 'Transaction Date', 'Description', 'Category', 'Amount'])).toEqual({
      desc: 'Description',
      amount: 'Amount',
      date: 'Transaction Date',
      category: 'Category',
    })
  })

  it('recognizes alternate names', () => {
    expect(detectColumns(['Posted', 'Payee', 'Debit'])).toEqual({
      desc: 'Payee',
      amount: 'Debit',
      date: 'Posted',
      category: '',
    })
  })

  it('prefers a strong name match over an earlier weak one', () => {
    expect(detectColumns(['Card Name', 'Description', 'Amount']).desc).toBe('Description')
  })

  it('falls back to the values when names give nothing away', () => {
    const rows: CsvRow[] = [
      { a: '03/02/2026', b: '1042', c: 'FAKE COFFEE CO', d: '-4.75' },
      { a: '03/03/2026', b: '1043', c: 'EXAMPLE GROCERY', d: '-38.20' },
    ]
    expect(detectColumns(['a', 'b', 'c', 'd'], rows)).toEqual({ desc: 'c', amount: 'd', date: 'a', category: '' })
  })

  it('leaves a column blank when nothing matches', () => {
    expect(detectColumns(['foo', 'bar'])).toEqual(NO_MAP)
  })
})

describe('findHeaderRow', () => {
  it('finds the header on the first line of a plain export', () => {
    expect(findHeaderRow(fixtureGrid('negative-purchases.csv'))).toBe(0)
  })

  it('skips preamble lines above the header', () => {
    expect(findHeaderRow(fixtureGrid('preamble.csv'))).toBe(3)
  })

  it('returns -1 when the file has no header row', () => {
    expect(findHeaderRow(fixtureGrid('no-header.csv'))).toBe(-1)
  })

  it('finds a header with unfamiliar names by its shape', () => {
    const grid = parseGrid('Bank export\nWhen,What,How much\n03/02/2026,COFFEE,4.75\n03/03/2026,BOOKS,9.00')
    expect(findHeaderRow(grid)).toBe(1)
  })
})

describe('toTable', () => {
  it('names blank and repeated headers so every column can be chosen', () => {
    const { headers } = toTable(parseGrid('Date,,Amount,Amount\n03/02/2026,x,1,2'), 0)
    expect(headers).toEqual(['Date', 'Column 2', 'Amount', 'Amount (2)'])
  })

  it('numbers the columns of a file without a header row', () => {
    const { headers, rows } = toTable(fixtureGrid('no-header.csv'), -1)
    expect(headers).toEqual(['Column 1', 'Column 2', 'Column 3', 'Column 4', 'Column 5'])
    expect(rows).toHaveLength(4)
  })
})

describe('a bank export where purchases are negative', () => {
  const { headers, rows } = toTable(fixtureGrid('negative-purchases.csv'), 0)
  const map = detectColumns(headers, rows)

  it('detects the sign convention', () => {
    expect(detectNegativePurchases(rows, map.amount)).toBe(true)
  })

  it('keeps purchases only: skips payments, refunds, and rows without a description', () => {
    const purchases = toPurchases(rows, map, true)
    expect(purchases).toEqual([
      { desc: 'FAKE COFFEE CO #1', amount: 4.75, date: '2026-03-02', cat: 'Food & Drink' },
      { desc: 'EXAMPLE GROCERY 22', amount: 1204.1, date: '2026-03-04', cat: 'Groceries' },
      { desc: 'SAMPLE TRANSIT', amount: 2.5, date: '2026-03-09', cat: 'Travel' },
    ])
  })

  it('with the sign toggle flipped, only the refund counts', () => {
    expect(toPurchases(rows, map, false)).toEqual([
      { desc: 'TEST BOOKSHOP', amount: 12, date: '2026-03-07', cat: 'Shopping' },
    ])
  })
})

describe('toPurchases', () => {
  const rows: CsvRow[] = [
    { Desc: 'SHOP A', Amt: '10.00' },
    { Desc: 'ONLINE PMT RECEIVED', Amt: '99.00' },
    { Desc: 'SHOP B', Amt: '0' },
  ]

  it('returns nothing until description and amount are both mapped', () => {
    expect(toPurchases(rows, { ...NO_MAP, desc: 'Desc' }, false)).toEqual([])
  })

  it('treats positive numbers as purchases by default and ignores zero', () => {
    expect(toPurchases(rows, { ...NO_MAP, desc: 'Desc', amount: 'Amt' }, false)).toEqual([
      { desc: 'SHOP A', amount: 10, date: '', cat: '' },
    ])
  })
})

describe('toTransactions', () => {
  it('creates unreviewed transactions with unique ids', () => {
    const txns = toTransactions([
      { desc: 'A', amount: 1, date: '', cat: '' },
      { desc: 'B', amount: 2, date: '', cat: 'Travel' },
    ])
    expect(txns.map((t) => t.status)).toEqual(['unreviewed', 'unreviewed'])
    expect(txns.every((t) => t.pileId === null && t.action === null && t.note === '')).toBe(true)
    expect(txns.map((t) => t.cat)).toEqual(['—', 'Travel'])
    expect(new Set(txns.map((t) => t.id)).size).toBe(2)
  })
})
