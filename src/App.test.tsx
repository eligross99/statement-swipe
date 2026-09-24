import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import App from './App'
import { makeStatement } from './lib/library'
import { loadLibrary, saveLibrary } from './lib/storage'
import type { Statement, Transaction } from './types'

// Stand-in for the on-device database: tests choose what's "saved" and check what gets written.
// e2e/statements.spec.ts covers the real database in a browser.
vi.mock('./lib/storage', async (original) => ({
  ...(await original<typeof import('./lib/storage')>()),
  loadLibrary: vi.fn(),
  saveLibrary: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(loadLibrary).mockReset().mockResolvedValue({ statements: [], ui: null, settings: null })
  vi.mocked(saveLibrary).mockReset().mockResolvedValue(undefined)
})

const purchase = (id: string, desc: string, status: Transaction['status'] = 'unreviewed'): Transaction => ({
  id,
  desc,
  amount: 5,
  date: '',
  cat: '—',
  status,
  pileId: null,
  action: null,
  note: '',
})

/** A saved statement: "Saved March", with FIRST SHOP approved and SECOND SHOP still to review. */
function savedStatement(extra: Partial<Statement> = {}): Statement {
  const st = makeStatement([purchase('a', 'FIRST SHOP'), purchase('b', 'SECOND SHOP')], {
    id: 'st_saved',
    name: 'Saved March',
    period: '2026-03-20',
    now: 0,
  })
  const txns = st.session.txns.map((t, i) => (i === 0 ? { ...t, status: 'approved' as const } : t))
  return {
    ...st,
    session: { ...st.session, txns, index: 1 },
    history: [{ txnId: 'a', index: 0, status: 'unreviewed', pileId: null }],
    ...extra,
  }
}

/** The description on the top card of the deck. */
function topCard() {
  return screen.getByRole('group', { name: /^Purchase:/ })
}

async function startSample() {
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'Import a statement' }))
  await user.click(screen.getByRole('button', { name: /Try the sample statement/ }))
  return user
}

describe('App', () => {
  it('starts on an empty Statements screen that says how to begin', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'No statements yet' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Import a statement' }))
    expect(screen.getByRole('heading', { name: 'Import your statement' })).toBeInTheDocument()
  })

  it('imports a CSV with intro lines above the header, names it by month, and starts the review', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Import a statement' }))
    const text = readFileSync(resolve(process.cwd(), 'tests/fixtures/preamble.csv'), 'utf8')
    const input = container.querySelector<HTMLInputElement>('input[type=file]')!
    await user.upload(input, new File([text], 'march.csv', { type: 'text/csv' }))

    expect(await screen.findByText(/3 rows found, after skipping 3 intro lines/)).toBeInTheDocument()
    expect(screen.getByLabelText('Column names')).toHaveValue('3')
    expect(screen.getByLabelText(/^Category/)).toHaveValue('Category')

    await user.click(screen.getByRole('button', { name: /Review 2 purchases/ }))
    expect(within(await screen.findByRole('group', { name: /^Purchase:/ })).getByText('FAKE COFFEE CO #1')).toBeInTheDocument()
    expect(screen.getByText('Dining')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^March 2026$/)
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

  it('keeps every statement: importing another adds it, and the list opens each where it was left', async () => {
    const user = await startSample()
    await user.click(screen.getByRole('button', { name: 'Approve' }))
    await user.click(screen.getByRole('button', { name: 'Back to statements' }))

    // Alone, the review in progress is the top row, so there's no banner repeating it.
    expect(screen.getByText('In progress, 15 of 16 left')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Pick up where you left off/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Import a statement' }))
    await user.click(screen.getByRole('button', { name: /Try the sample statement/ }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('0 of 16 reviewed')).toBeInTheDocument()
    // A second statement with the same name gets a number.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('March 2026 sample (2)')

    await user.click(screen.getByRole('button', { name: 'Back to statements' }))
    expect(screen.getAllByRole('button', { name: /^March 2026 sample/ })).toHaveLength(2)
    expect(screen.getByText('Needs review')).toBeInTheDocument()
    // The newer statement is on top now, so the banner offers the one in progress below it.
    const banner = screen.getByRole('button', { name: /Pick up where you left off/ })
    expect(banner).toHaveTextContent('15 of 16 purchases left')
    await user.click(banner)
    expect(screen.getByText('1 of 16 reviewed')).toBeInTheDocument()
  })

  it('renames the open statement by tapping its title', async () => {
    const user = await startSample()
    await user.click(screen.getByRole('button', { name: 'March 2026 sample' }))
    const field = screen.getByRole('textbox', { name: 'Statement name' })
    await user.clear(field)
    await user.type(field, 'Try-out{Enter}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Try-out')
  })

  it('renames, archives, and deletes from a statement’s ⋯ menu, asking before deleting', async () => {
    vi.mocked(loadLibrary).mockResolvedValue({ statements: [savedStatement()], ui: null, settings: null })
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'More for Saved March' }))
    await user.click(screen.getByRole('button', { name: 'Rename' }))
    const field = screen.getByRole('textbox', { name: 'Statement name' })
    await user.clear(field)
    await user.type(field, 'March card')
    await user.click(screen.getByRole('button', { name: 'Save name' }))
    expect(screen.getAllByText('March card').length).toBeGreaterThan(0)

    // Archiving moves it under Archived.
    await user.click(screen.getByRole('button', { name: 'More for March card' }))
    await user.click(screen.getByRole('button', { name: 'Archive' }))
    expect(screen.getByRole('heading', { name: 'Every statement is archived' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Archived' }))
    expect(screen.getByRole('button', { name: 'More for March card' })).toBeInTheDocument()

    // Deleting asks first; Cancel keeps it.
    await user.click(screen.getByRole('button', { name: 'More for March card' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    const confirm = screen.getByRole('dialog', { name: 'Delete “March card”?' })
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('button', { name: 'More for March card' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'More for March card' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Delete statement' }))
    expect(screen.getByRole('heading', { name: 'No statements yet' })).toBeInTheDocument()
    await waitFor(() => expect(saveLibrary).toHaveBeenLastCalledWith([], ['st_saved'], expect.anything(), expect.anything()))
  })

  it('remembers the chosen filter and says when nothing needs action', async () => {
    const done = savedStatement({ session: { ...savedStatement().session, index: 2, screen: 'summary' } })
    done.session.txns = done.session.txns.map((t) => ({ ...t, status: 'approved' }))
    vi.mocked(loadLibrary).mockResolvedValue({ statements: [done], ui: null, settings: null })
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByText('Clear')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Needs action' }))
    expect(screen.getByRole('heading', { name: 'Nothing needs action' })).toBeInTheDocument()
    await waitFor(() =>
      expect(saveLibrary).toHaveBeenLastCalledWith([], [], expect.objectContaining({ filter: 'action' }), expect.anything()),
    )
  })

  it('erases everything from Settings, after asking, then shows the empty Statements screen', async () => {
    vi.mocked(loadLibrary).mockResolvedValue({ statements: [savedStatement()], ui: null, settings: null })
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Settings' }))
    expect(screen.getByText(/1 statement saved on this device/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Erase everything on this device' }))
    expect(screen.getByRole('dialog', { name: 'Erase everything?' })).toHaveTextContent('Your statement, with its folders')
    await user.click(screen.getByRole('button', { name: 'Erase everything' }))
    // Back to an empty Statements screen.
    expect(await screen.findByRole('heading', { name: 'No statements yet' })).toBeInTheDocument()
    await waitFor(() => expect(saveLibrary).toHaveBeenLastCalledWith([], ['st_saved'], expect.anything(), expect.anything()))
  })

  it('offers folder names from past statements when filing', async () => {
    const past = savedStatement({ id: 'st_past', name: 'February' })
    past.session.piles = [{ id: 'f_old', name: 'Taxes' }]
    past.session.txns = past.session.txns.map((t, i) => (i === 0 ? { ...t, status: 'piled', pileId: 'f_old' } : t))
    vi.mocked(loadLibrary).mockResolvedValue({ statements: [past], ui: null, settings: null })
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Import a statement' }))
    await user.click(screen.getByRole('button', { name: /Try the sample statement/ }))

    await user.click(screen.getByRole('button', { name: 'File' }))
    expect(screen.getByText('Names you’ve used before')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Taxes' }))
    expect(screen.getByText('1 of 16 reviewed')).toBeInTheDocument()
    // Now it's one of this statement's folders.
    await user.click(screen.getByRole('button', { name: 'File' }))
    expect(screen.getByRole('button', { name: /^Taxes/ })).toBeInTheDocument()
    expect(screen.queryByText('Names you’ve used before')).not.toBeInTheDocument()
  })

  it('stops suggesting past folder names when that’s turned off in Settings, and remembers it', async () => {
    const past = savedStatement({ id: 'st_past', name: 'February' })
    past.session.piles = [{ id: 'f_old', name: 'Taxes' }]
    past.session.txns = past.session.txns.map((t, i) => (i === 0 ? { ...t, status: 'piled', pileId: 'f_old' } : t))
    vi.mocked(loadLibrary).mockResolvedValue({ statements: [past], ui: null, settings: null })
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Settings' }))
    const toggle = screen.getByRole('switch', { name: 'Suggest past folder names' })
    expect(toggle).toBeChecked()
    await user.click(toggle)
    expect(toggle).not.toBeChecked()
    await waitFor(() =>
      expect(saveLibrary).toHaveBeenLastCalledWith([], [], expect.anything(), { suggestFolders: false }),
    )

    await user.click(screen.getByRole('button', { name: 'Back to statements' }))
    await user.click(screen.getByRole('button', { name: 'Import a statement' }))
    await user.click(screen.getByRole('button', { name: /Try the sample statement/ }))
    await user.click(screen.getByRole('button', { name: 'File' }))
    expect(screen.queryByText('Names you’ve used before')).not.toBeInTheDocument()
    expect(screen.getByText(/No folders yet/)).toBeInTheDocument()
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

  it('lets a purchase flagged earlier be approved from the summary', async () => {
    const user = await startSample()
    await user.click(screen.getByRole('button', { name: 'Look closer' }))
    await user.click(screen.getByRole('button', { name: /flag as possible fraud/ }))
    for (let i = 0; i < 15; i++) await user.click(screen.getByRole('button', { name: 'Approve' }))
    expect(screen.getByRole('heading', { name: /Flagged as possible fraud/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /TRADER JOE'S/ }))
    // It asks first; cancelling keeps the purchase flagged.
    await user.click(screen.getByRole('button', { name: 'I recognize it, approve it' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog', { name: 'Approve this purchase?' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'I recognize it, approve it' }))
    await user.click(screen.getByRole('button', { name: 'Yes, approve it' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Flagged as possible fraud/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo last action' })).toBeEnabled()
  })

  it('says under Filed whether anything is left to act on', async () => {
    const user = await startSample()
    await user.click(screen.getByRole('button', { name: 'File' }))
    await user.type(screen.getByRole('textbox', { name: 'New folder name' }), 'Ski trip{Enter}')
    for (let i = 0; i < 15; i++) await user.click(screen.getByRole('button', { name: 'Approve' }))
    expect(screen.getByText(/still to act on/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Ski trip/ }))
    await user.click(screen.getByRole('button', { name: /Status: not set/ }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^Done/ }))
    await user.click(screen.getByRole('button', { name: 'Back to all folders' }))
    expect(screen.queryByText(/still to act on/)).not.toBeInTheDocument()
    expect(screen.getByText('All settled')).toBeInTheDocument()
  })

  it('asks before deleting a folder and says what happens to its purchases', async () => {
    const user = await startSample()
    await user.click(screen.getByRole('button', { name: 'File' }))
    await user.type(screen.getByRole('textbox', { name: 'New folder name' }), 'Ski trip{Enter}')
    await user.click(screen.getByRole('button', { name: 'File' }))

    await user.click(screen.getByRole('button', { name: 'Delete folder Ski trip' }))
    const confirm = screen.getByRole('dialog', { name: 'Delete this folder?' })
    expect(within(confirm).getByText(/The 1 purchase in “Ski trip” will move to Approved/)).toBeInTheDocument()
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('button', { name: /^Ski trip/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete folder Ski trip' }))
    await user.click(screen.getByRole('button', { name: 'Delete folder' }))
    expect(screen.queryByRole('button', { name: /^Ski trip/ })).not.toBeInTheDocument()
    expect(screen.getByText(/No folders yet/)).toBeInTheDocument()
  })

  it('splits folders into Action needed and Settled, moving them as statuses change', async () => {
    const user = await startSample()
    for (const name of ['Ski trip', 'Taxes']) {
      await user.click(screen.getByRole('button', { name: 'File' }))
      await user.type(screen.getByRole('textbox', { name: 'New folder name' }), `${name}{Enter}`)
    }
    for (let i = 0; i < 14; i++) await user.click(screen.getByRole('button', { name: 'Approve' }))
    // Both need action: one list, no group labels.
    expect(screen.queryByRole('heading', { name: 'Action needed' })).not.toBeInTheDocument()

    const settle = async (folder: string) => {
      await user.click(screen.getByRole('button', { name: new RegExp(folder) }))
      await user.click(screen.getByRole('button', { name: /Status: not set/ }))
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^Done/ }))
      await user.click(screen.getByRole('button', { name: 'Back to all folders' }))
    }
    await settle('Ski trip')
    const needed = screen.getByRole('heading', { name: 'Action needed' })
    const settled = screen.getByRole('heading', { name: 'Settled' })
    expect(needed.nextElementSibling).toHaveTextContent('Taxes')
    expect(settled.nextElementSibling).toHaveTextContent('Ski trip')

    // Everything settled: back to one list, with "All settled" beside the heading.
    await settle('Taxes')
    expect(screen.queryByRole('heading', { name: 'Settled' })).not.toBeInTheDocument()
    expect(screen.getByText('All settled')).toBeInTheDocument()
  })

  it('shows the same readable date on the card and in the investigation view', async () => {
    const user = await startSample()
    expect(within(topCard()).getByText('Mar 3')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Look closer' }))
    expect(screen.getByText('Tue, Mar 3, 2026')).toBeInTheDocument()
  })

  it('saves the changed statement after a change', async () => {
    const user = await startSample()
    await user.click(screen.getByRole('button', { name: 'Approve' }))
    await waitFor(() =>
      expect(saveLibrary).toHaveBeenLastCalledWith(
        [expect.objectContaining({ session: expect.objectContaining({ index: 1 }) })],
        [],
        expect.objectContaining({ view: 'review' }),
        { suggestFolders: true },
      ),
    )
    const [put] = vi.mocked(saveLibrary).mock.lastCall!
    expect(put[0].session.txns[0].status).toBe('approved')
  })

  it('reopens the review the user was in, with undo still working', async () => {
    vi.mocked(loadLibrary).mockResolvedValue({
      statements: [savedStatement()],
      ui: { openId: 'st_saved', view: 'review', filter: 'all' },
      settings: null,
    })
    const user = userEvent.setup()
    render(<App />)
    expect(await screen.findByText('SECOND SHOP')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Saved March')
    expect(screen.getByText('1 of 2 reviewed')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Undo last action' }))
    expect(within(topCard()).getByText('FIRST SHOP')).toBeInTheDocument()
    expect(screen.getByText('0 of 2 reviewed')).toBeInTheDocument()
  })
})
