// @vitest-environment node
// Runs the real PDF reader (pdfjs) on synthetic PDFs. The Node environment lets pdfjs run its
// worker in-process, as it does in scripts/pdf-layout.ts.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { isPdf, PdfImportError, PDFSource } from './pdfSource'

function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(resolve(process.cwd(), 'tests/fixtures', name)))
}

/** The problem a failed import reports. */
async function problem(data: Uint8Array) {
  try {
    await PDFSource.fromData(data, pdfjs)
  } catch (e) {
    return e instanceof PdfImportError ? e.problem : e
  }
  return 'no error'
}

describe('PDFSource', () => {
  it('reads the purchases out of a statement PDF', async () => {
    const source = await PDFSource.fromData(fixture('sample-statement.pdf'), pdfjs)
    expect(source.purchases().map((p) => [p.desc, p.amount, p.date])).toEqual([
      ['FAKE COFFEE CO #12 OAKLAND CA', 4.75, '2026-06-15'],
      ['SAMPLE GROCERY 0042 BERKELEY CA', 86.2, '2026-06-28'],
      ['SQ *EXAMPLE BAR SAN FRANCISCO CA', 42, '2026-07-02'],
      ['EXAMPLE AIRLINES 0061234567890', 947, '2026-07-10'],
    ])
    expect(source.statement.check).toEqual({ printed: 1079.95, found: 1079.95 })
  })

  it('produces unreviewed transactions ready for the deck', async () => {
    const txns = await (await PDFSource.fromData(fixture('sample-statement.pdf'), pdfjs)).load()
    expect(txns).toHaveLength(4)
    expect(txns.every((t) => t.status === 'unreviewed' && t.pileId === null && t.cat === '—')).toBe(true)
  })

  it('explains when a PDF has no text, like a scanned statement', async () => {
    expect(await problem(fixture('scanned-statement.pdf'))).toBe('no-text')
  })

  it('explains when a file is not really a PDF', async () => {
    expect(await problem(new TextEncoder().encode('%PDF-1.4 not really'))).toBe('unreadable')
  })

  it('recognizes PDF bytes regardless of the file name', () => {
    expect(isPdf(fixture('sample-statement.pdf'))).toBe(true)
    expect(isPdf(new TextEncoder().encode('Date,Description,Amount'))).toBe(false)
  })
})
