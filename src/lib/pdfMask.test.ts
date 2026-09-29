import { mask, maskedLayout } from './pdfMask'
import type { Line } from './pdfLines'

describe('mask', () => {
  it('hides letters and digits but keeps statement words and punctuation', () => {
    expect(mask('SHELL OIL 574123900')).toBe('XXXXX XXX 999999999')
    expect(mask('Total Purchases $1,234.56')).toBe('Total Purchases $9,999.99')
    expect(mask('Jul 13 Jane Doe')).toBe('Jul 99 Xxxx Xxx')
  })
})

describe('maskedLayout', () => {
  it('lists each page’s lines, masked, under a heading', () => {
    const line = (page: number, y: number, x: number, text: string): Line => ({ page, y, cells: [{ x, text }], text })
    const out = maskedLayout([line(1, 700, 36.4, 'Acme 4.75'), line(2, 690, 36, 'Payments')], 'About this file')
    expect(out).toBe('About this file\n\n=== Page 1 ===\ny700 @36 Xxxx 9.99\n\n=== Page 2 ===\ny690 @36 Payments')
  })
})
