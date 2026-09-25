import type { Transaction } from '../types'
import {
  initialLibrary,
  libraryReducer,
  makeStatement,
  openStatement,
  type LibraryAction,
  type LibraryState,
} from './library'

function txn(id: string): Transaction {
  return { id, desc: `SHOP ${id}`, amount: 10, date: '', cat: '—', status: 'approved', pileId: null, action: 'done', note: 'x' }
}

const statement = (id: string) => makeStatement([txn('a'), txn('b')], { id, name: `Statement ${id}`, period: null, now: 0 })

/** An action, optionally with the time it happened (0 if not given). */
type Step = LibraryAction & { now?: number }

const step = (state: LibraryState, e: Step) => libraryReducer(state, { now: 0, ...e })
const run = (...events: Step[]): LibraryState => events.reduce(step, initialLibrary)
const add = (id: string): Step => ({ type: 'add', id, txns: [txn('a'), txn('b')], name: `Statement ${id}`, period: null })
const review = (event: Extract<LibraryAction, { type: 'review' }>['event'], now = 5): Step => ({
  type: 'review',
  event,
  now,
})

describe('adding a statement', () => {
  it('opens it on the first card, with fresh review state', () => {
    const s = run(add('one'))
    expect(s.view).toBe('review')
    const st = openStatement(s)!
    expect(st.session.screen).toBe('deck')
    expect(st.session.txns[0]).toMatchObject({ status: 'unreviewed', action: null, note: '' })
  })

  it('keeps earlier statements', () => {
    expect(run(add('one'), add('two')).statements.map((s) => s.id)).toEqual(['one', 'two'])
  })
})

describe('reviewing the open statement', () => {
  it('passes review events to the open statement only, and notes when it changed', () => {
    const s = run(add('one'), add('two'), review({ type: 'approve' }, 42))
    const [one, two] = s.statements
    expect(one.session.index).toBe(0)
    expect(two.session.index).toBe(1)
    expect(two.updatedAt).toBe(42)
    expect(two.history).toHaveLength(1)
  })

  it('ignores review events when no statement is open', () => {
    const s = run(add('one'), { type: 'go', view: 'statements' })
    expect(run(add('one'), { type: 'go', view: 'statements' }, review({ type: 'approve' }))).toEqual(s)
  })
})

describe('opening a statement', () => {
  it('lands where the user left off, or on the summary when finished, with folders closed', () => {
    let s = run(add('one'), review({ type: 'approve' }), { type: 'go', view: 'statements' }, { type: 'open', id: 'one' })
    expect(openStatement(s)!.session).toMatchObject({ screen: 'deck', index: 1 })

    s = run(
      add('one'),
      review({ type: 'approve' }),
      review({ type: 'createPileAndFile', pile: { id: 'f', name: 'Split' } }),
      review({ type: 'openPile', pileId: 'f' }),
      { type: 'go', view: 'statements' },
      { type: 'open', id: 'one' },
    )
    expect(openStatement(s)!.session).toMatchObject({ screen: 'summary', openPile: null })
  })

  it('ignores a statement that no longer exists', () => {
    const s = run(add('one'), { type: 'go', view: 'statements' })
    expect(step(s, { type: 'open', id: 'gone' })).toBe(s)
  })
})

describe('managing statements', () => {
  it('renames, ignoring blank names', () => {
    let s = run(add('one'), { type: 'rename', id: 'one', name: '  July card  ', now: 7 })
    expect(s.statements[0]).toMatchObject({ name: 'July card', updatedAt: 7 })
    s = step(s, { type: 'rename', id: 'one', name: '   ', now: 8 })
    expect(s.statements[0].name).toBe('July card')
  })

  it('archives and unarchives', () => {
    let s = run(add('one'), { type: 'archive', id: 'one', archived: true, now: 1 })
    expect(s.statements[0].archived).toBe(true)
    s = step(s, { type: 'archive', id: 'one', archived: false, now: 2 })
    expect(s.statements[0].archived).toBe(false)
  })

  it('deleting the open statement goes back to Statements', () => {
    const s = run(add('one'), add('two'), { type: 'delete', id: 'two' })
    expect(s.statements.map((st) => st.id)).toEqual(['one'])
    expect(s.view).toBe('statements')
    expect(openStatement(s)).toBeNull()
  })

  it('erasing everything keeps only preferences: the chosen filter and settings', () => {
    const s = run(
      add('one'),
      { type: 'setFilter', filter: 'archived' },
      { type: 'setSettings', settings: { suggestFolders: false } },
      { type: 'eraseAll' },
    )
    expect(s).toEqual({ ...initialLibrary, filter: 'archived', settings: { suggestFolders: false, remindAfterDays: 14 } })
  })
})

describe('loading', () => {
  it('uses default settings for anything not saved', () => {
    const defaults = { suggestFolders: true, remindAfterDays: 14 }
    expect(run({ type: 'loaded', statements: [], ui: null, settings: null }).settings).toEqual(defaults)
    expect(run({ type: 'loaded', statements: [], ui: null, settings: {} }).settings).toEqual(defaults)
    const off = run({ type: 'loaded', statements: [], ui: null, settings: { suggestFolders: false } })
    expect(off.settings.suggestFolders).toBe(false)
  })

  it('reopens the review the user was in', () => {
    const s = run({ type: 'loaded', statements: [statement('one')], ui: { openId: 'one', view: 'review', filter: 'action' }, settings: null })
    expect(s).toMatchObject({ view: 'review', openId: 'one', filter: 'action' })
  })

  it('starts on Statements when nothing was open, or the open statement is gone', () => {
    expect(run({ type: 'loaded', statements: [], ui: null, settings: null }).view).toBe('statements')
    const gone = run({ type: 'loaded', statements: [], ui: { openId: 'one', view: 'review', filter: 'all' }, settings: null })
    expect(gone).toMatchObject({ view: 'statements', openId: null })
    const settings = run({ type: 'loaded', statements: [], ui: { openId: null, view: 'settings', filter: 'all' }, settings: null })
    expect(settings.view).toBe('statements')
  })

  it('returns to the tab the user was last on', () => {
    const ui = { openId: null, view: 'settings' as const, filter: 'all' as const, home: 'tasks' as const }
    expect(run({ type: 'loaded', statements: [], ui, settings: null })).toMatchObject({ view: 'tasks', home: 'tasks' })
  })
})

describe('tabs and tasks', () => {
  it('remembers the last tab, so Back from Settings or a review returns there', () => {
    const s = run(add('one'), { type: 'go', view: 'tasks' }, { type: 'go', view: 'settings' })
    expect(s).toMatchObject({ view: 'settings', home: 'tasks' })
    expect(run({ type: 'go', view: 'tasks' }, { type: 'go', view: 'statements' }).home).toBe('statements')
  })

  it('changes a statement that isn’t open, when given its id', () => {
    const s = run(add('one'), review({ type: 'flag' }), add('two'), { type: 'go', view: 'tasks' })
    const after = step(s, { type: 'review', id: 'one', event: { type: 'setAction', txnId: 'a', action: 'done' }, now: 9 })
    expect(after.statements[0].session.txns[0]).toMatchObject({ action: 'done', actionAt: 9 })
    expect(after.statements[0].updatedAt).toBe(9)
    expect(after.view).toBe('tasks')
  })
})
