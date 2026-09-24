import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PdfStatement } from '../lib/statementPdf'
import { PdfImportError, PDFSource } from '../sources/pdfSource'
import { ImportScreen } from './ImportScreen'

// The real PDF reader needs a browser worker, so these tests hand the screen a statement directly.
// pdfSource.test.ts covers reading real PDF files.

const statement = (check: PdfStatement['check']): PdfStatement => ({
  purchases: [
    { desc: 'FAKE COFFEE CO #12', amount: 4.75, date: '2026-06-15', cat: '' },
    { desc: 'SAMPLE GROCERY 0042', amount: 86.2, date: '2026-06-28', cat: '' },
  ],
  skipped: 1,
  check,
  closing: '2026-07-13',
})

const pdfFile = () => new File(['%PDF-1.4\n'], 'eStmt_2026-07-13.pdf', { type: 'application/pdf' })

async function choosePdf() {
  const user = userEvent.setup()
  const onStart = vi.fn()
  const { container } = render(<ImportScreen current={null} onStart={onStart} />)
  await user.upload(container.querySelector<HTMLInputElement>('input[type=file]')!, pdfFile())
  return { user, onStart }
}

afterEach(() => vi.restoreAllMocks())

describe('ImportScreen with a PDF', () => {
  it('shows the purchases found and says when they match the statement total', async () => {
    vi.spyOn(PDFSource, 'fromData').mockResolvedValue(new PDFSource(statement({ printed: 90.95, found: 90.95 })))
    const { user, onStart } = await choosePdf()

    expect(await screen.findByText('2 purchases found in this statement.')).toBeInTheDocument()
    expect(screen.getByText(/^Matches the/)).toHaveTextContent('Matches the $90.95 in purchases on your statement.')
    expect(screen.getByText('FAKE COFFEE CO #12')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Review 2 purchases/ }))
    expect(onStart).toHaveBeenCalledWith(
      [expect.objectContaining({ desc: 'FAKE COFFEE CO #12', amount: 4.75, status: 'unreviewed' }), expect.anything()],
      'eStmt_2026-07-13',
    )
  })

  it('says when the purchases found don’t add up to the statement total', async () => {
    vi.spyOn(PDFSource, 'fromData').mockResolvedValue(new PDFSource(statement({ printed: 120, found: 90.95 })))
    await choosePdf()
    expect(await screen.findByText(/Some may be missing or extra/)).toHaveTextContent(
      'These add up to $90.95, but your statement lists $120.00 in purchases.',
    )
  })

  it('explains what to do with a scanned PDF', async () => {
    vi.spyOn(PDFSource, 'fromData').mockRejectedValue(new PdfImportError('no-text'))
    await choosePdf()
    expect(await screen.findByRole('alert')).toHaveTextContent(/looks like a scan/)
    expect(screen.getByRole('heading', { name: 'Import your statement' })).toBeInTheDocument()
  })

  it('explains when the PDF reader itself can’t load', async () => {
    vi.spyOn(PDFSource, 'fromData').mockRejectedValue(new TypeError('Failed to fetch dynamically imported module'))
    await choosePdf()
    expect(await screen.findByRole('alert')).toHaveTextContent(/Check your internet connection/)
  })

  it('shows every purchase after "Show all"', async () => {
    const many = statement(null)
    many.purchases = Array.from({ length: 7 }, (_, i) => ({ desc: `SHOP ${i + 1}`, amount: 1, date: '', cat: '' }))
    vi.spyOn(PDFSource, 'fromData').mockResolvedValue(new PDFSource(many))
    const { user } = await choosePdf()

    expect(await screen.findByText('SHOP 5')).toBeInTheDocument()
    expect(screen.queryByText('SHOP 6')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show all 7' }))
    expect(screen.getByText('SHOP 7')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Show all/ })).not.toBeInTheDocument()
  })
})
