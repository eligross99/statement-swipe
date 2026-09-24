import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { get, set } from 'idb-keyval'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import App from './App'
import type { Session } from './types'

vi.mock('idb-keyval', () => ({ get: vi.fn(), set: vi.fn() }))

beforeEach(() => {
  vi.mocked(get).mockReset().mockResolvedValue(undefined)
  vi.mocked(set).mockReset().mockResolvedValue(undefined)
})

/** The description on the top card of the deck. */
function topCard() {
  return screen.getByRole('group', { name: /^Purchase:/ })
}

async function startSample() {
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: /Try the sample statement/ }))
  return user
}

describe('App', () => {
  it('starts on the import screen when nothing is saved', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Import your statement' })).toBeInTheDocument()
  })

  it('imports a CSV with intro lines above the header and starts the review', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    await screen.findByRole('heading', { name: 'Import your statement' })
    const text = readFileSync(resolve(process.cwd(), 'tests/fixtures/preamble.csv'), 'utf8')
    const input = container.querySelector<HTMLInputElement>('input[type=file]')!
    await user.upload(input, new File([text], 'march.csv', { type: 'text/csv' }))

    expect(await screen.findByText(/3 rows found, after skipping 3 intro lines/)).toBeInTheDocument()
    expect(screen.getByLabelText('Column names')).toHaveValue('3')
    expect(screen.getByLabelText(/^Category/)).toHaveValue('Category')

    await user.click(screen.getByRole('button', { name: /Review 2 purchases/ }))
    expect(within(await screen.findByRole('group', { name: /^Purchase:/ })).getByText('FAKE COFFEE CO #1')).toBeInTheDocument()
    expect(screen.getByText('Dining')).toBeInTheDocument()
  })

  it('approving advances the deck and updates progress', async () => {
    const user = await startSample()
    expect(within(topCard()).getByText("TRADER JOE'S #512 BOSTON MA")).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Approve' }))
    expect(within(topCard()).getByText('SQ *DD BAR LLC 8004563')).toBeInTheDocument()
    expect(screen.getByText('1 of 16 reviewed')).toBeInTheDocument()
  })

  it('arrow keys act on the top card', async () => {
    const user = await startSample()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByText('1 of 16 reviewed')).toBeInTheDocument()
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('look closer opens the investigation view without dismissing the card', async () => {
    const user = await startSample()
    await user.click(screen.getByRole('button', { name: 'Look closer' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: "TRADER JOE'S #512 BOSTON MA" })).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: /Back/ }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(within(topCard()).getByText("TRADER JOE'S #512 BOSTON MA")).toBeInTheDocument()
    expect(screen.getByText('0 of 16 reviewed')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Look closer' }))
    await user.click(screen.getByRole('button', { name: /flag as possible fraud/ }))
    expect(screen.getByText('1 of 16 reviewed')).toBeInTheDocument()
  })

  it('files a purchase into a new folder, then into the same folder', async () => {
    const user = await startSample()
    await user.click(screen.getByRole('button', { name: 'File' }))
    expect(screen.getByText(/No folders yet/)).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: 'New folder name' }), 'Ski trip{Enter}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('1 of 16 reviewed')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'File' }))
    await user.click(screen.getByRole('button', { name: /^Ski trip/ }))
    expect(screen.getByText('2 of 16 reviewed')).toBeInTheDocument()
  })

  it('undo brings back the previous card', async () => {
    const user = await startSample()
    await user.click(screen.getByRole('button', { name: 'Approve' }))
    await user.click(screen.getByRole('button', { name: 'Undo last action' }))
    expect(within(topCard()).getByText("TRADER JOE'S #512 BOSTON MA")).toBeInTheDocument()
    expect(screen.getByText('0 of 16 reviewed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo last action' })).toBeDisabled()
  })

  it('reaches the summary after the last card and opens a folder for triage', async () => {
    const user = await startSample()
    await user.click(screen.getByRole('button', { name: 'File' }))
    await user.type(screen.getByRole('textbox', { name: 'New folder name' }), 'Ski trip{Enter}')
    for (let i = 0; i < 15; i++) await user.click(screen.getByRole('button', { name: 'Approve' }))

    expect(screen.getByRole('heading', { name: 'Review complete' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Ski trip/ }))
    expect(screen.getByRole('heading', { level: 2, name: 'Ski trip' })).toBeInTheDocument()

    expect(screen.getByText('Still to act on')).toBeInTheDocument()

    // The status menu: pick "Done", which settles the folder.
    await user.click(screen.getByRole('button', { name: /Status: not set/ }))
    const menu = screen.getByRole('dialog', { name: 'Set status' })
    await user.click(within(menu).getByRole('button', { name: /^Done/ }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Status: Done/ })).toBeInTheDocument()
    expect(screen.getByText('All settled')).toBeInTheDocument()

    // Clearing the status puts it back to "not set".
    await user.click(screen.getByRole('button', { name: /Status: Done/ }))
    await user.click(screen.getByRole('button', { name: 'Clear status' }))
    expect(screen.getByRole('button', { name: /Status: not set/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add note' }))
    await user.type(screen.getByRole('textbox', { name: /Note for/ }), 'Venmo Sam  ')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    // Tapping the saved note reopens the editor, with the stray spaces trimmed.
    await user.click(screen.getByRole('button', { name: 'Edit note: Venmo Sam' }))
    expect(screen.getByRole('textbox', { name: /Note for/ })).toHaveValue('Venmo Sam')
  })

  it('asks before a new statement replaces a review in progress, and can go back to it', async () => {
    const user = await startSample()
    await user.click(screen.getByRole('button', { name: 'Approve' }))
    await user.click(screen.getByRole('button', { name: 'New statement' }))
    expect(screen.getByText(/is saved/)).toBeInTheDocument()

    // Keeping the review closes the question and changes nothing.
    await user.click(screen.getByRole('button', { name: /Try the sample statement/ }))
    const confirm = screen.getByRole('dialog', { name: 'Replace your review?' })
    expect(within(confirm).getByText(/1 of 16 purchases/)).toBeInTheDocument()
    await user.click(within(confirm).getByRole('button', { name: 'Keep my review' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // The header's back button returns to the review where it was left.
    await user.click(screen.getByRole('button', { name: 'Back to your review' }))
    expect(screen.getByText('1 of 16 reviewed')).toBeInTheDocument()

    // Replacing it starts fresh.
    await user.click(screen.getByRole('button', { name: 'New statement' }))
    await user.click(screen.getByRole('button', { name: /Try the sample statement/ }))
    await user.click(screen.getByRole('button', { name: 'Replace it' }))
    expect(screen.getByText('0 of 16 reviewed')).toBeInTheDocument()
  })

  it('starts a new statement without asking when nothing has been reviewed yet', async () => {
    const user = await startSample()
    await user.click(screen.getByRole('button', { name: 'New statement' }))
    await user.click(screen.getByRole('button', { name: /Try the sample statement/ }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('0 of 16 reviewed')).toBeInTheDocument()
  })

  it('uses the top-left button to go back from a folder to all folders', async () => {
    const user = await startSample()
    await user.click(screen.getByRole('button', { name: 'File' }))
    await user.type(screen.getByRole('textbox', { name: 'New folder name' }), 'Ski trip{Enter}')
    for (let i = 0; i < 15; i++) await user.click(screen.getByRole('button', { name: 'Approve' }))
    await user.click(screen.getByRole('button', { name: /Ski trip/ }))
    expect(screen.queryByRole('button', { name: 'Undo last action' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back to all folders' }))
    expect(screen.getByRole('heading', { name: 'Review complete' })).toBeInTheDocument()
  })

  it('shows the same readable date on the card and in the investigation view', async () => {
    const user = await startSample()
    expect(within(topCard()).getByText('Mar 3')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Look closer' }))
    expect(screen.getByText('Tue, Mar 3, 2026')).toBeInTheDocument()
  })

  it('saves the session to IndexedDB after a change', async () => {
    const user = await startSample()
    await user.click(screen.getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(set).toHaveBeenCalled())
    const saved = vi.mocked(set).mock.lastCall?.[1] as Session
    expect(saved.index).toBe(1)
    expect(saved.txns[0].status).toBe('approved')
  })

  it('restores a saved session on load', async () => {
    const saved: Session = {
      txns: [
        { id: 'a', desc: 'FIRST SHOP', amount: 5, date: '', cat: '—', status: 'approved', pileId: null, action: null, note: '' },
        { id: 'b', desc: 'SECOND SHOP', amount: 7, date: '', cat: '—', status: 'unreviewed', pileId: null, action: null, note: '' },
      ],
      index: 1,
      piles: [],
      screen: 'deck',
      label: 'Saved March',
      openPile: null,
    }
    vi.mocked(get).mockResolvedValue(saved)
    render(<App />)
    expect(await screen.findByText('SECOND SHOP')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Saved March' })).toBeInTheDocument()
    expect(screen.getByText('1 of 2 reviewed')).toBeInTheDocument()
  })
})
