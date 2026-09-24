import type { Statement, Transaction } from '../types'
import { makeStatement } from './library'
import { reviewReducer, type ReviewEvent } from './review'
import {
  defaultName,
  filterStatements,
  monthName,
  needsAction,
  pastFolderNames,
  progress,
  statementPeriod,
  uniqueName,
} from './statements'

function txn(id: string, date = ''): Transaction {
  return { id, desc: `SHOP ${id}`, amount: 10, date, cat: '—', status: 'unreviewed', pileId: null, action: null, note: '' }
}

/** A statement of three purchases after `events`, with the given dates and fields. */
function st(id: string, events: ReviewEvent[] = [], extra: Partial<Statement> = {}): Statement {
  const base = makeStatement([txn('a'), txn('b'), txn('c')], { id, name: id, period: null, now: 0 })
  const review = events.reduce((s, e) => reviewReducer(s, e, 0), { session: base.session, history: base.history })
  return { ...base, ...review, ...extra }
}

const ALL_APPROVED: ReviewEvent[] = [{ type: 'approve' }, { type: 'approve' }, { type: 'approve' }]

describe('names', () => {
  it('uses the closing date, else the latest purchase date', () => {
    expect(statementPeriod([txn('a', '2026-06-20'), txn('b', '2026-07-02')], '2026-07-13')).toBe('2026-07-13')
    expect(statementPeriod([txn('a', '2026-07-02'), txn('b', '2026-06-20'), txn('c', 'Jul 9')])).toBe('2026-07-02')
    expect(statementPeriod([txn('a', 'Jul 9')])).toBeNull()
  })

  it('names a statement after its month, numbering repeats', () => {
    expect(monthName('2026-07-13')).toBe('July 2026')
    expect(defaultName('2026-07-13', 'eStmt', [])).toBe('July 2026')
    expect(defaultName('2026-07-13', 'eStmt', ['july 2026'])).toBe('July 2026 (2)')
    expect(uniqueName('July 2026', ['July 2026', 'July 2026 (2)'])).toBe('July 2026 (3)')
  })

  it('falls back to the file name when there are no dates', () => {
    expect(defaultName(null, 'eStmt_0713', [])).toBe('eStmt_0713')
    expect(defaultName(null, '  ', [])).toBe('Statement')
  })
})

describe('progress', () => {
  it('tells new, in-progress, and finished statements apart', () => {
    expect(progress(st('x')).stage).toBe('new')
    expect(progress(st('x', [{ type: 'approve' }]))).toMatchObject({ stage: 'progress', left: 2, total: 3 })
    expect(progress(st('x', ALL_APPROVED)).stage).toBe('done')
  })

  it('counts flagged, to do (including no status yet), and waiting purchases', () => {
    const pile = { id: 'f', name: 'Split' }
    const s = st('x', [
      { type: 'flag' },
      { type: 'createPileAndFile', pile },
      { type: 'file', pileId: 'f' },
      { type: 'setAction', txnId: 'c', action: 'waiting' },
    ])
    expect(progress(s)).toMatchObject({ stage: 'done', flagged: 1, todo: 1, waiting: 1 })
    expect(needsAction(progress(s))).toBe(true)
  })

  it('a resolved flag no longer needs action', () => {
    const s = st('x', [...ALL_APPROVED.slice(1), { type: 'flag' }, { type: 'setAction', txnId: 'c', action: 'done' }])
    expect(progress(s).flagged).toBe(0)
    expect(needsAction(progress(s))).toBe(false)
  })

  it('a finished statement with everything settled needs no action', () => {
    const s = st('x', [
      { type: 'approve' },
      { type: 'approve' },
      { type: 'createPileAndFile', pile: { id: 'f', name: 'Split' } },
      { type: 'setAction', txnId: 'c', action: 'done' },
    ])
    expect(needsAction(progress(s))).toBe(false)
  })
})

describe('filterStatements', () => {
  const clear = st('clear', ALL_APPROVED, { period: '2026-05-10' })
  const open = st('open', [], { period: '2026-07-10' })
  const archived = st('archived', [], { period: '2026-06-10', archived: true })
  const undated = st('undated', [], { addedAt: Date.UTC(2026, 5, 1) })
  const list = [clear, open, archived, undated]

  it('shows unarchived statements newest first', () => {
    expect(filterStatements(list, 'all').map((s) => s.id)).toEqual(['open', 'undated', 'clear'])
  })

  it('shows only statements needing action, or only archived ones', () => {
    expect(filterStatements(list, 'action').map((s) => s.id)).toEqual(['open', 'undated'])
    expect(filterStatements(list, 'archived').map((s) => s.id)).toEqual(['archived'])
  })
})

describe('pastFolderNames', () => {
  const withFolder = (id: string, name: string, updatedAt: number) =>
    st(id, [{ type: 'createPileAndFile', pile: { id: `f_${id}`, name } }], { updatedAt })

  it('offers folder names from other statements, most recent first, without repeats', () => {
    const current = withFolder('cur', 'Taxes', 5)
    const list = [current, withFolder('a', 'Ski trip', 1), withFolder('b', 'Reimburse', 3), withFolder('c', 'ski trip', 2)]
    expect(pastFolderNames(list, current)).toEqual(['Reimburse', 'ski trip']) // the most recent spelling wins
  })

  it('skips names already here and folders that ended up empty', () => {
    const current = withFolder('cur', 'Taxes', 5)
    const emptied = st('e', [{ type: 'createPileAndFile', pile: { id: 'f', name: 'Gone' } }, { type: 'undo' }])
    expect(pastFolderNames([current, withFolder('a', 'taxes', 1), emptied], current)).toEqual([])
  })
})
