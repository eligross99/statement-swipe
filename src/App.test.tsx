import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { get, set } from 'idb-keyval'
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

  it('approving advances the deck and updates progress', async () => {
    const user = await startSample()
    expect(within(topCard()).getByText("TRADER JOE'S #512 BOSTON MA")).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Approve' }))
    expect(within(topCard()).getByText('SQ *DD BAR LLC 8004563')).toBeInTheDocument()
    expect(screen.getByText('1 of 16')).toBeInTheDocument()
  })

  it('arrow keys act on the top card', async () => {
    const user = await startSample()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByText('1 of 16')).toBeInTheDocument()
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
    expect(screen.getByText('0 of 16')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Look closer' }))
    await user.click(screen.getByRole('button', { name: /Flag as possible fraud/ }))
    expect(screen.getByText('1 of 16')).toBeInTheDocument()
  })

  it('files a purchase into a new folder, then into the same folder', async () => {
    const user = await startSample()
    await user.click(screen.getByRole('button', { name: 'File it' }))
    expect(screen.getByText(/No folders yet/)).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: 'New folder name' }), 'Ski trip{Enter}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('1 of 16')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'File it' }))
    await user.click(screen.getByRole('button', { name: /^Ski trip/ }))
    expect(screen.getByText('2 of 16')).toBeInTheDocument()
  })

  it('undo brings back the previous card', async () => {
    const user = await startSample()
    await user.click(screen.getByRole('button', { name: 'Approve' }))
    await user.click(screen.getByRole('button', { name: 'Undo last action' }))
    expect(within(topCard()).getByText("TRADER JOE'S #512 BOSTON MA")).toBeInTheDocument()
    expect(screen.getByText('0 of 16')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo last action' })).toBeDisabled()
  })

  it('reaches the summary after the last card and opens a folder for triage', async () => {
    const user = await startSample()
    await user.click(screen.getByRole('button', { name: 'File it' }))
    await user.type(screen.getByRole('textbox', { name: 'New folder name' }), 'Ski trip{Enter}')
    for (let i = 0; i < 15; i++) await user.click(screen.getByRole('button', { name: 'Approve' }))

    expect(screen.getByRole('heading', { name: 'Review complete' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Ski trip/ }))
    expect(screen.getByRole('heading', { name: 'Ski trip' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Next step: not set/ }))
    expect(screen.getByRole('button', { name: /Next step: To do/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add note' }))
    await user.type(screen.getByRole('textbox', { name: /Note for/ }), 'Venmo Sam')
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.getByText('Venmo Sam')).toBeInTheDocument()
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
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
  })
})
