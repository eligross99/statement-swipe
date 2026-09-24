// A synthetic card statement laid out like a typical US bank's PDF (modeled on the masked layout of a
// real one): an account summary where the "$" is drawn apart from its number, a page of fine print,
// then transactions under section headings with posting dates, city and state in their own columns,
// reference and account numbers, dated $0.00 interest rows, and a "Transactions Continued" page.
// Every name and number is made up. scripts/make-pdf-fixtures.ts writes it to
// tests/fixtures/sample-statement.pdf.

import type { PdfText } from './makePdf'

/** Description parts (merchant, city, state) each start a little after the previous one ends. */
function descCells(y: number, parts: string[]): PdfText[] {
  let x = 117
  return parts.map((text) => {
    const cell = { x, y, text }
    x += text.length * 6.5 + 12 // about 6.5pt per capital letter at 9pt, then a column gap
    return cell
  })
}

const row = (y: number, date: string, posted: string, desc: string[], amount: string, ref = '4411'): PdfText[] => [
  { x: 36, y, text: date },
  { x: 82, y, text: posted },
  ...descCells(y, desc),
  { x: 365, y, text: ref },
  { x: 423, y, text: '9876' },
  { x: 500, y, text: amount },
]

const label = (y: number, text: string, amount: string): PdfText[] => [
  { x: 36, y, text },
  { x: 246, y, text: amount },
]

const pageTop = (title: string): PdfText[] => [
  { x: 36, y: 749, text: 'Account # 0000 0000 0000 9876 June 14 - July 13, 2026' },
  { x: 36, y: 707, text: title, size: 12 },
  { x: 36, y: 682, text: 'Date', size: 7 },
  { x: 82, y: 682, text: 'Date', size: 7 },
  { x: 117, y: 682, text: 'Description', size: 7 },
  { x: 358, y: 682, text: 'Number', size: 7 },
  { x: 417, y: 682, text: 'Number', size: 7 },
  { x: 497, y: 682, text: 'Amount', size: 7 },
]

export function sampleStatementPages(): PdfText[][] {
  return [
    [
      { x: 36, y: 750, text: 'Example Bank Rewards Card', size: 14 },
      { x: 400, y: 732, text: 'June 14 - July 13, 2026', size: 10 },
      { x: 36, y: 700, text: 'Account Summary', size: 12 },
      ...label(684, 'Previous Balance', '$537.39'),
      ...label(670, 'Payments and Other Credits', '-$537.39'),
      // The "$" sits apart from the number, and another column follows on the same line.
      { x: 36, y: 656, text: 'Purchases and Adjustments' },
      { x: 240, y: 657, text: '$' },
      { x: 251, y: 656, text: '1,079.95' },
      { x: 300, y: 656, text: 'Payment Due Date' },
      { x: 500, y: 656, text: '08/07/2026' },
      ...label(642, 'Fees Charged', '$0.00'),
      ...label(628, 'Interest Charged', '$0.00'),
      ...label(614, 'New Balance Total', '$1,079.95'),
      ...label(576, 'Statement Closing Date', '07/13/2026'),
    ],
    [
      // Fine print that mentions section names mid-paragraph. It must not be read as a heading.
      { x: 40, y: 700, text: 'Your balance includes new Purchases and fees, minus any payments and credits.' },
      { x: 40, y: 690, text: 'Interest is charged on Purchases from the transaction date unless paid in full.' },
    ],
    [
      ...pageTop('Transactions'),
      { x: 117, y: 666, text: 'Payments and Other Credits', size: 10 },
      ...row(657, '07/01', '07/01', ['PAYMENT FROM CHK 0000 CONF#abc123'], '-512.40', '0001'),
      ...row(645, '06/20', '06/21', ['EXAMPLE OUTFITTERS', 'SEATTLE', 'WA'], '-24.99', '0002'),
      { x: 132, y: 633, text: 'TOTAL PAYMENTS AND OTHER CREDITS FOR THIS PERIOD' },
      { x: 535, y: 633, text: '-$537.39' },
      { x: 117, y: 611, text: 'Purchases and Adjustments', size: 10 },
      ...row(602, '06/15', '06/16', ['FAKE COFFEE CO #12', 'OAKLAND', 'CA'], '4.75'),
      ...row(592, '06/28', '06/29', ['SAMPLE GROCERY 0042', 'BERKELEY', 'CA'], '86.20', '4412'),
      { x: 117, y: 61, text: 'continued on next page...' },
    ],
    [
      ...pageTop('Transactions Continued'),
      { x: 117, y: 666, text: 'Purchases and Adjustments', size: 10 },
      ...row(657, '07/02', '07/03', ['SQ *EXAMPLE BAR', 'SAN FRANCISCO', 'CA'], '42.00', '4413'),
      ...row(648, '07/10', '07/11', ['EXAMPLE AIRLINES 0061234567890'], '947.00', '4414'),
      // A detail line under a purchase, with no date of its own.
      { x: 117, y: 639, text: 'FOREIGN CURRENCY 07/10 USD/EUR 1.08' },
      { x: 132, y: 620, text: 'TOTAL PURCHASES AND ADJUSTMENTS FOR THIS PERIOD' },
      { x: 540, y: 620, text: '$1,079.95' },
      { x: 117, y: 598, text: 'Interest Charged', size: 10 },
      ...row(589, '07/13', '07/13', ['INTEREST CHARGED ON PURCHASES'], '0.00', ''),
      ...row(580, '07/13', '07/13', ['INTEREST CHARGED ON CASH ADVANCES'], '0.00', ''),
      { x: 132, y: 571, text: 'TOTAL INTEREST CHARGED FOR THIS PERIOD' },
      { x: 556, y: 571, text: '$0.00' },
      { x: 128, y: 540, text: 'Total fees charged in 2026' },
      { x: 350, y: 540, text: '$0.00' },
      { x: 36, y: 500, text: 'Purchases' },
      { x: 189, y: 500, text: '21.99%V' },
      { x: 474, y: 500, text: '$0.00' },
    ],
  ]
}
