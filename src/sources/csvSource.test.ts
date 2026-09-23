import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseGrid } from '../lib/csv'
import { CSVSource, guessSettings } from './csvSource'

function fixture(name: string): string {
  return readFileSync(resolve(process.cwd(), 'tests/fixtures', name), 'utf8')
}

/** What the deck would show: just the fields the CSV provides. */
async function loaded(name: string) {
  const txns = await CSVSource.fromText(fixture(name)).load()
  return txns.map(({ desc, amount, date, cat }) => ({ desc, amount, date, cat }))
}

describe('CSVSource', () => {
  it('reads an export with preamble lines above the header', async () => {
    expect(await loaded('preamble.csv')).toEqual([
      { desc: 'FAKE COFFEE CO #1', amount: 4.75, date: '2026-03-02', cat: 'Dining' },
      { desc: 'SAMPLE HARDWARE', amount: 1020, date: '2026-03-08', cat: 'Home' },
    ])
  })

  it('reads an export with no header row, guessing columns from the values', async () => {
    expect(await loaded('no-header.csv')).toEqual([
      { desc: 'FAKE COFFEE CO #1', amount: 4.75, date: '2026-03-02', cat: '—' },
      { desc: 'EXAMPLE GROCERY 22', amount: 38.2, date: '2026-03-04', cat: '—' },
      { desc: 'SAMPLE TRANSIT', amount: 2.5, date: '2026-03-09', cat: '—' },
    ])
  })

  it('reads split debit/credit columns, keeping debits and skipping credits', async () => {
    expect(await loaded('debit-credit.csv')).toEqual([
      { desc: 'FAKE COFFEE CO #1', amount: 4.75, date: '2026-03-02', cat: '—' },
      { desc: 'EXAMPLE GROCERY 22', amount: 38.2, date: '2026-03-04', cat: '—' },
    ])
  })

  it('reads a plain export where purchases are negative', async () => {
    expect((await loaded('negative-purchases.csv')).map((t) => t.desc)).toEqual([
      'FAKE COFFEE CO #1',
      'EXAMPLE GROCERY 22',
      'SAMPLE TRANSIT',
    ])
  })

  it('produces unreviewed transactions ready for the deck', async () => {
    const txns = await CSVSource.fromText(fixture('preamble.csv')).load()
    expect(txns.every((t) => t.status === 'unreviewed' && t.pileId === null)).toBe(true)
  })

  it('honors a header row chosen by the user', () => {
    const grid = parseGrid(fixture('preamble.csv'))
    const settings = guessSettings(grid, 3)
    expect(new CSVSource(grid, settings).table.headers).toEqual(['Date', 'Description', 'Category', 'Amount'])
  })

  it('ignores a byte-order mark at the start of the file', () => {
    const source = CSVSource.fromText('﻿Date,Description,Amount\n03/02/2026,COFFEE,4.75')
    expect(source.table.headers[0]).toBe('Date')
  })
})
