import { toLines, type TextFragment } from './pdfLines'

/** A fragment with a rough Helvetica width (half the font size per character). */
const frag = (x: number, y: number, str: string, size = 10): TextFragment => ({
  str,
  x,
  y,
  size,
  width: str.length * size * 0.5,
})

describe('toLines', () => {
  it('orders lines top to bottom and cells left to right', () => {
    const lines = toLines([frag(300, 500, '4.75'), frag(40, 500, '03/02'), frag(40, 520, 'Transactions')])
    expect(lines.map((l) => l.text)).toEqual(['Transactions', '03/02 4.75'])
    expect(lines[1].cells.map((c) => c.x)).toEqual([40, 300])
  })

  it('keeps fragments with slightly different baselines on one line', () => {
    const lines = toLines([frag(40, 500, '03/02'), frag(120, 501.5, 'COFFEE')])
    expect(lines).toHaveLength(1)
  })

  it('joins words drawn separately into one cell, and splits wide gaps into cells', () => {
    // "FAKE" is 20pt wide at 10pt, so a 3pt gap is a space and a 60pt gap is a new column.
    const lines = toLines([frag(100, 500, 'FAKE'), frag(123, 500, 'COFFEE'), frag(300, 500, '4.75')])
    expect(lines[0].cells.map((c) => c.text)).toEqual(['FAKE COFFEE', '4.75'])
  })

  it('joins letters drawn one at a time without adding spaces', () => {
    const letters = [...'CAFE'].map((ch, i) => frag(100 + i * 5, 500, ch))
    expect(toLines(letters)[0].text).toBe('CAFE')
  })

  it('skips blank fragments and records the page number', () => {
    const lines = toLines([frag(40, 500, '  '), frag(40, 480, 'Total')], 3)
    expect(lines).toEqual([{ page: 3, y: 480, cells: [{ x: 40, text: 'Total' }], text: 'Total' }])
  })
})
