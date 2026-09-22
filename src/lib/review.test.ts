import type { Transaction } from '../types'
import {
  currentTxn,
  initialReviewState,
  nextAction,
  pileItems,
  reviewReducer,
  stillToActOn,
  type ReviewEvent,
  type ReviewState,
} from './review'

function txn(id: string, amount: number): Transaction {
  return { id, desc: `SHOP ${id}`, amount, date: '', cat: '—', status: 'unreviewed', pileId: null, action: null, note: '' }
}

const TXNS = [txn('a', 10), txn('b', 20), txn('c', 30)]
const SKI = { id: 'ski', name: 'Ski trip' }

/** Applies events in order, starting from a fresh review of TXNS. */
function run(...events: ReviewEvent[]): ReviewState {
  return [{ type: 'start', txns: TXNS, label: 'Test' } as ReviewEvent, ...events].reduce(reviewReducer, initialReviewState)
}

const statuses = (s: ReviewState) => s.session.txns.map((t) => t.status)

describe('starting a review', () => {
  it('opens the deck on the first card with no folders', () => {
    const s = run()
    expect(s.session.screen).toBe('deck')
    expect(s.session.index).toBe(0)
    expect(s.session.piles).toEqual([])
    expect(currentTxn(s.session)?.id).toBe('a')
  })

  it('resets any review state carried on the incoming transactions', () => {
    const dirty = [{ ...txn('x', 5), status: 'approved' as const, note: 'old' }]
    const s = reviewReducer(initialReviewState, { type: 'start', txns: dirty, label: '' })
    expect(s.session.txns[0]).toMatchObject({ status: 'unreviewed', note: '' })
  })
})

describe('resolving cards', () => {
  it('approve, flag, and file each set a terminal status and advance', () => {
    const s = run({ type: 'approve' }, { type: 'flag' }, { type: 'createPileAndFile', pile: SKI })
    expect(statuses(s)).toEqual(['approved', 'flagged', 'piled'])
    expect(s.session.txns[2].pileId).toBe('ski')
    expect(s.session.piles).toEqual([SKI])
  })

  it('files into an existing folder', () => {
    const s = run({ type: 'createPileAndFile', pile: SKI }, { type: 'file', pileId: 'ski' })
    expect(pileItems(s.session.txns, 'ski').map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('ignores filing into a folder that does not exist', () => {
    const s = run({ type: 'file', pileId: 'nope' })
    expect(s.session.index).toBe(0)
    expect(statuses(s)).toEqual(['unreviewed', 'unreviewed', 'unreviewed'])
  })

  it('only reaches the summary once every card is in a terminal state', () => {
    let s = run({ type: 'approve' }, { type: 'approve' })
    expect(s.session.screen).toBe('deck')
    s = reviewReducer(s, { type: 'flag' })
    expect(s.session.screen).toBe('summary')
    expect(s.session.txns.every((t) => t.status !== 'unreviewed')).toBe(true)
  })

  it('does nothing once the deck is finished', () => {
    const done = run({ type: 'approve' }, { type: 'approve' }, { type: 'approve' })
    expect(reviewReducer(done, { type: 'approve' })).toBe(done)
    expect(currentTxn(done.session)).toBeNull()
  })
})

describe('undo', () => {
  it('puts the last card back as unreviewed and returns to it', () => {
    const s = run({ type: 'approve' }, { type: 'createPileAndFile', pile: SKI }, { type: 'undo' })
    expect(statuses(s)).toEqual(['approved', 'unreviewed', 'unreviewed'])
    expect(s.session.txns[1].pileId).toBeNull()
    expect(s.session.index).toBe(1)
    expect(s.history).toHaveLength(1)
  })

  it('works from the summary so the final card can be undone', () => {
    const s = run({ type: 'approve' }, { type: 'approve' }, { type: 'flag' }, { type: 'undo' })
    expect(s.session.screen).toBe('deck')
    expect(currentTxn(s.session)?.id).toBe('c')
  })

  it('keeps notes and triage on other purchases', () => {
    let s = run({ type: 'createPileAndFile', pile: SKI }, { type: 'approve' }, { type: 'approve' })
    s = reviewReducer(s, { type: 'setNote', txnId: 'a', note: 'Venmo Sam' })
    s = reviewReducer(s, { type: 'undo' })
    expect(s.session.txns[0].note).toBe('Venmo Sam')
  })

  it('does nothing with an empty history', () => {
    const s = run()
    expect(reviewReducer(s, { type: 'undo' })).toBe(s)
  })
})

describe('deleting a folder', () => {
  it('reverts its purchases to approved with no folder, never unreviewed', () => {
    const s = run({ type: 'createPileAndFile', pile: SKI }, { type: 'file', pileId: 'ski' }, { type: 'deletePile', pileId: 'ski' })
    expect(s.session.piles).toEqual([])
    expect(s.session.txns.slice(0, 2)).toEqual([
      expect.objectContaining({ status: 'approved', pileId: null }),
      expect.objectContaining({ status: 'approved', pileId: null }),
    ])
    expect(s.session.index).toBe(2)
  })

  it('leaves the summary if the open folder is deleted', () => {
    let s = run({ type: 'createPileAndFile', pile: SKI }, { type: 'approve' }, { type: 'approve' }, { type: 'openPile', pileId: 'ski' })
    expect(s.session.screen).toBe('pile')
    s = reviewReducer(s, { type: 'deletePile', pileId: 'ski' })
    expect(s.session.screen).toBe('summary')
    expect(s.session.openPile).toBeNull()
  })
})

describe('folder triage', () => {
  it('"still to act on" sums everything not marked done', () => {
    let s = run(
      { type: 'createPileAndFile', pile: SKI },
      { type: 'file', pileId: 'ski' },
      { type: 'file', pileId: 'ski' },
    )
    const items = () => pileItems(s.session.txns, 'ski')
    expect(stillToActOn(items())).toBe(60)
    s = reviewReducer(s, { type: 'setAction', txnId: 'b', action: 'done' })
    s = reviewReducer(s, { type: 'setAction', txnId: 'c', action: 'waiting' })
    expect(stillToActOn(items())).toBe(40)
  })

  it('status cycles none → to do → waiting → done → none', () => {
    expect([null, 'todo', 'waiting', 'done'].map((a) => nextAction(a as never))).toEqual(['todo', 'waiting', 'done', null])
  })
})

describe('navigation', () => {
  it('restart wipes review state and folders but keeps the purchases', () => {
    let s = run({ type: 'createPileAndFile', pile: SKI }, { type: 'setNote', txnId: 'a', note: 'x' }, { type: 'restart' })
    expect(statuses(s)).toEqual(['unreviewed', 'unreviewed', 'unreviewed'])
    expect(s.session.piles).toEqual([])
    expect(s.session.txns[0].note).toBe('')
    s = reviewReducer(s, { type: 'approve' })
    expect(s.session.index).toBe(1)
  })

  it('going to import and resuming returns to where the user was', () => {
    const mid = run({ type: 'approve' }, { type: 'goImport' })
    expect(mid.session.screen).toBe('import')
    expect(reviewReducer(mid, { type: 'resume' }).session.screen).toBe('deck')

    const finished = run({ type: 'approve' }, { type: 'approve' }, { type: 'approve' }, { type: 'goImport' })
    expect(reviewReducer(finished, { type: 'resume' }).session.screen).toBe('summary')
  })

  it('restoring a session saved on the import screen reopens the review', () => {
    const saved = run({ type: 'approve' }, { type: 'goImport' }).session
    const s = reviewReducer(initialReviewState, { type: 'restore', session: saved })
    expect(s.session.screen).toBe('deck')
    expect(s.session.index).toBe(1)
  })
})
