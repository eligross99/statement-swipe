import type { Statement, Transaction } from '../types'
import { makeStatement } from './library'
import { reviewReducer, type ReviewEvent } from './review'
import { allTasks, DAY_MS, groupTasks, overdueCount } from './tasks'

function txn(id: string): Transaction {
  return { id, desc: `SHOP ${id}`, amount: 10, date: '', cat: '—', status: 'unreviewed', pileId: null, action: null, note: '' }
}

/** A statement of four purchases after `events`, each stamped with its [event, time]. */
function st(id: string, events: [ReviewEvent, number][], extra: Partial<Statement> = {}): Statement {
  const base = makeStatement([txn('a'), txn('b'), txn('c'), txn('d')], { id, name: id, period: null, now: 0 })
  const review = events.reduce((s, [e, now]) => reviewReducer(s, e, now), { session: base.session, history: base.history })
  return { ...base, ...review, ...extra }
}

const SPLIT = { id: 'f', name: 'Split' }
/** a: flagged, b: filed (no status), c: filed and waiting, d: approved. */
const EVENTS: [ReviewEvent, number][] = [
  [{ type: 'flag' }, 1 * DAY_MS],
  [{ type: 'createPileAndFile', pile: SPLIT }, 2 * DAY_MS],
  [{ type: 'file', pileId: 'f' }, 3 * DAY_MS],
  [{ type: 'approve' }, 4 * DAY_MS],
  [{ type: 'setAction', txnId: 'c', action: 'waiting' }, 5 * DAY_MS],
]

describe('allTasks', () => {
  it('lists flagged and filed purchases, with their folder, and skips approved ones', () => {
    const tasks = allTasks([st('x', EVENTS)], 0, null)
    expect(tasks.map((t) => [t.txn.id, t.group, t.pile?.name ?? null])).toEqual([
      ['a', 'fraud', null],
      ['b', 'todo', 'Split'],
      ['c', 'waiting', 'Split'],
    ])
    expect(new Set(tasks.map((t) => t.key)).size).toBe(3)
  })

  it('includes statements still being reviewed, but not archived ones', () => {
    const halfway = st('half', [[{ type: 'flag' }, 0]])
    const archived = st('arch', EVENTS, { archived: true })
    expect(allTasks([halfway, archived], 0, null).map((t) => t.key)).toEqual(['half:a'])
  })

  it('keeps a flag in Possible fraud until it is resolved, then moves it to Done', () => {
    const waiting = st('x', [...EVENTS, [{ type: 'setAction', txnId: 'a', action: 'waiting' }, 0]])
    expect(allTasks([waiting], 0, null)[0].group).toBe('fraud')
    const resolved = st('x', [...EVENTS, [{ type: 'setAction', txnId: 'a', action: 'done' }, 0]])
    expect(allTasks([resolved], 0, null)[0].group).toBe('done')
  })

  it('marks open tasks overdue once untouched for the reminder time', () => {
    const now = 15 * DAY_MS // a: 14 days, b: 13 days, c: 10 days since last touched
    const overdue = (days: number | null) =>
      allTasks([st('x', EVENTS)], now, days)
        .filter((t) => t.overdue)
        .map((t) => t.txn.id)
    expect(overdue(14)).toEqual(['a'])
    expect(overdue(7)).toEqual(['a', 'b', 'c'])
    expect(overdue(null)).toEqual([])
  })

  it('never marks Done tasks overdue', () => {
    const done = st('x', [...EVENTS, [{ type: 'setAction', txnId: 'b', action: 'done' }, 0]])
    expect(overdueCount(allTasks([done], 100 * DAY_MS, 7))).toBe(2)
  })

  it('counts purchases from before task clocks from the statement’s last change', () => {
    const old = st('x', EVENTS, { updatedAt: 10 * DAY_MS })
    for (const t of old.session.txns) delete t.actionAt
    expect(allTasks([old], 23 * DAY_MS, 14).some((t) => t.overdue)).toBe(false)
    expect(allTasks([old], 24 * DAY_MS, 14).every((t) => t.overdue)).toBe(true)
  })
})

describe('groupTasks', () => {
  it('lists open tasks oldest first and Done newest first', () => {
    const s = st('x', [
      ...EVENTS,
      [{ type: 'setAction', txnId: 'c', action: 'todo' }, 6 * DAY_MS],
      [{ type: 'setAction', txnId: 'a', action: 'done' }, 7 * DAY_MS],
      [{ type: 'setAction', txnId: 'c', action: 'done' }, 8 * DAY_MS],
    ])
    const groups = groupTasks(allTasks([s], 0, null))
    expect(groups.todo.map((t) => t.txn.id)).toEqual(['b'])
    expect(groups.done.map((t) => t.txn.id)).toEqual(['c', 'a'])
    expect(groups.fraud).toEqual([])
  })
})
