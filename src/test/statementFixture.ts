// A synthetic card statement laid out like a typical US bank's PDF: an account summary on page 1,
// then transactions grouped under section headings with a posting date, reference and account
// number columns. Every name and number is made up. scripts/make-pdf-fixtures.ts writes it to
// tests/fixtures/sample-statement.pdf.

import type { PdfText } from './makePdf'

const row = (y: number, date: string, posted: string, desc: string, amount: string, ref = '4411'): PdfText[] => [
  { x: 40, y, text: date },
  { x: 85, y, text: posted },
  { x: 130, y, text: desc },
  { x: 400, y, text: ref },
  { x: 460, y, text: '9876' },
  { x: 530, y, text: amount },
]

const label = (y: number, text: string, amount: string): PdfText[] => [
  { x: 40, y, text },
  { x: 300, y, text: amount },
]

export function sampleStatementPages(): PdfText[][] {
  return [
    [
      { x: 40, y: 750, text: 'Example Bank Rewards Card', size: 14 },
      { x: 40, y: 732, text: 'June 14 - July 13, 2026', size: 10 },
      { x: 40, y: 700, text: 'Account Summary', size: 12 },
      ...label(684, 'Previous Balance', '$537.39'),
      ...label(670, 'Payments and Other Credits', '-$537.39'),
      ...label(656, 'Purchases and Adjustments', '+$1,079.95'),
      ...label(642, 'Fees Charged', '+$0.00'),
      ...label(628, 'Interest Charged', '+$0.00'),
      ...label(614, 'New Balance Total', '$1,079.95'),
      ...label(590, 'Payment Due Date', '08/07/2026'),
      ...label(576, 'Statement Closing Date', '07/13/2026'),
    ],
    [
      { x: 40, y: 750, text: 'Transactions', size: 12 },
      { x: 40, y: 730, text: 'Date', size: 7 },
      { x: 85, y: 730, text: 'Posted', size: 7 },
      { x: 130, y: 730, text: 'Description', size: 7 },
      { x: 400, y: 730, text: 'Reference', size: 7 },
      { x: 460, y: 730, text: 'Account', size: 7 },
      { x: 530, y: 730, text: 'Amount', size: 7 },
      { x: 40, y: 712, text: 'Payments and Other Credits', size: 10 },
      ...row(698, '07/01', '07/01', 'PAYMENT - THANK YOU', '-512.40', '0001'),
      ...row(684, '06/20', '06/21', 'EXAMPLE OUTFITTERS SEATTLE WA', '-24.99', '0002'),
      { x: 40, y: 668, text: 'TOTAL PAYMENTS AND OTHER CREDITS FOR THIS PERIOD' },
      { x: 530, y: 668, text: '-$537.39' },
      { x: 40, y: 648, text: 'Purchases and Adjustments', size: 10 },
      ...row(634, '06/15', '06/16', 'FAKE COFFEE CO #12 OAKLAND CA', '4.75'),
      ...row(620, '06/28', '06/29', 'SAMPLE GROCERY 0042 BERKELEY CA', '86.20', '4412'),
      ...row(606, '07/02', '07/03', 'SQ *EXAMPLE BAR SAN FRANCISCO CA', '42.00', '4413'),
      ...row(592, '07/10', '07/11', 'EXAMPLE AIRLINES 0061234567890', '947.00', '4414'),
      { x: 40, y: 576, text: 'TOTAL PURCHASES AND ADJUSTMENTS FOR THIS PERIOD' },
      { x: 530, y: 576, text: '$1,079.95' },
      { x: 40, y: 556, text: 'Fees Charged', size: 10 },
      { x: 40, y: 542, text: 'TOTAL FEES CHARGED FOR THIS PERIOD' },
      { x: 530, y: 542, text: '$0.00' },
      { x: 40, y: 522, text: 'Interest Charged', size: 10 },
      { x: 130, y: 508, text: 'INTEREST CHARGED ON PURCHASES' },
      { x: 530, y: 508, text: '0.00' },
      { x: 40, y: 494, text: 'TOTAL INTEREST CHARGED FOR THIS PERIOD' },
      { x: 530, y: 494, text: '$0.00' },
    ],
  ]
}
