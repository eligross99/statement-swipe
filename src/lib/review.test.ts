import type { Transaction } from '../types'
import {
  currentTxn,
  folderGroups,
  ledgerSegments,
  newReview,
  pileItems,
  reviewReducer,
  reviewScreen,
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
  return events.reduce((s, e) => reviewReducer(s, e, 0), newReview(TXNS))
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
    const s = newReview(dirty)
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
    s = reviewReducer(s, { type: 'flag' }, 0)
    expect(s.session.screen).toBe('summary')
    expect(s.session.txns.every((t) => t.status !== 'unreviewed')).toBe(true)
  })

  it('does nothing once the deck is finished', () => {
    const done = run({ type: 'approve' }, { type: 'approve' }, { type: 'approve' })
    expect(reviewReducer(done, { type: 'approve' }, 0)).toBe(done)
    expect(currentTxn(done.session)).toBeNull()
  })
})

describe('changing your mind about a flagged purchase', () => {
  it('moves a flagged purchase to approved, from the summary', () => {
    const s = run({ type: 'flag' }, { type: 'approve' }, { type: 'approve' }, { type: 'approveFlagged', txnId: 'a' })
    expect(s.session.screen).toBe('summary')
    expect(statuses(s)).toEqual(['approved', 'approved', 'approved'])
  })

  it('clears its resolution status, so it leaves Tasks', () => {
    let s = run({ type: 'flag' }, { type: 'approve' }, { type: 'approve' })
    s = reviewReducer(s, { type: 'setAction', txnId: 'a', action: 'waiting' }, 0)
    s = reviewReducer(s, { type: 'approveFlagged', txnId: 'a' }, 0)
    expect(s.session.txns[0]).toMatchObject({ status: 'approved', action: null })
  })

  it('ignores purchases that are not flagged', () => {
    const before = run({ type: 'approve' })
    expect(reviewReducer(before, { type: 'approveFlagged', txnId: 'a' }, 0)).toBe(before)
    expect(reviewReducer(before, { type: 'approveFlagged', txnId: 'b' }, 0)).toBe(before)
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
    s = reviewReducer(s, { type: 'setNote', txnId: 'a', note: 'Venmo Sam' }, 0)
    s = reviewReducer(s, { type: 'undo' }, 0)
    expect(s.session.txns[0].note).toBe('Venmo Sam')
  })

  it('does nothing with an empty history', () => {
    const s = run()
    expect(reviewReducer(s, { type: 'undo' }, 0)).toBe(s)
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
    s = reviewReducer(s, { type: 'deletePile', pileId: 'ski' }, 0)
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
    s = reviewReducer(s, { type: 'setAction', txnId: 'b', action: 'done' }, 0)
    s = reviewReducer(s, { type: 'setAction', txnId: 'c', action: 'waiting' }, 0)
    expect(stillToActOn(items())).toBe(40)
  })

  it('a status can be cleared, which counts it as still to act on again', () => {
    let s = run({ type: 'createPileAndFile', pile: SKI })
    s = reviewReducer(s, { type: 'setAction', txnId: 'a', action: 'done' }, 0)
    expect(stillToActOn(pileItems(s.session.txns, 'ski'))).toBe(0)
    s = reviewReducer(s, { type: 'setAction', txnId: 'a', action: null }, 0)
    expect(s.session.txns[0].action).toBeNull()
    expect(stillToActOn(pileItems(s.session.txns, 'ski'))).toBe(10)
  })
})

describe('task clock', () => {
  it('records when a purchase is filed, flagged, or given a status', () => {
    let s = newReview(TXNS)
    s = reviewReducer(s, { type: 'flag' }, 100)
    s = reviewReducer(s, { type: 'createPileAndFile', pile: SKI }, 200)
    s = reviewReducer(s, { type: 'setAction', txnId: 'b', action: 'waiting' }, 300)
    expect(s.session.txns.map((t) => t.actionAt)).toEqual([100, 300, undefined])
  })

  it('a card decided again starts with no status', () => {
    let s = run({ type: 'createPileAndFile', pile: SKI })
    s = reviewReducer(s, { type: 'setAction', txnId: 'a', action: 'done' }, 0)
    s = reviewReducer(s, { type: 'undo' }, 0)
    s = reviewReducer(s, { type: 'flag' }, 0)
    expect(s.session.txns[0]).toMatchObject({ status: 'flagged', action: null })
  })
})

describe('navigation', () => {
  it('restart wipes review state and folders but keeps the purchases', () => {
    let s = run({ type: 'createPileAndFile', pile: SKI }, { type: 'setNote', txnId: 'a', note: 'x' }, { type: 'restart' })
    expect(statuses(s)).toEqual(['unreviewed', 'unreviewed', 'unreviewed'])
    expect(s.session.piles).toEqual([])
    expect(s.session.txns[0].note).toBe('')
    s = reviewReducer(s, { type: 'approve' }, 0)
    expect(s.session.index).toBe(1)
  })

  it('reopening a statement lands on the deck if cards remain, else the summary', () => {
    expect(reviewScreen(run({ type: 'approve' }).session)).toBe('deck')
    expect(reviewScreen(run({ type: 'approve' }, { type: 'approve' }, { type: 'approve' }).session)).toBe('summary')
  })
})

describe('folderGroups', () => {
  const piles = [
    { id: 'p1', name: 'Settled' },
    { id: 'p2', name: 'Open' },
    { id: 'p3', name: 'Empty' },
    { id: 'p4', name: 'Also open' },
  ]
  const filed = (id: string, pileId: string, action: Transaction['action']): Transaction => ({
    ...txn(id, 10),
    status: 'piled',
    pileId,
    action,
  })

  it('lists folders needing action first, settled last, and leaves out empty ones', () => {
    const txns = [filed('a', 'p1', 'done'), filed('b', 'p2', 'todo'), filed('c', 'p4', null), filed('d', 'p4', 'done')]
    const groups = folderGroups(txns, piles)
    expect(groups.map((g) => g.pile.name)).toEqual(['Open', 'Also open', 'Settled'])
    expect(groups.map((g) => g.open)).toEqual([1, 1, 0])
  })
})

describe('ledgerSegments', () => {
  const t = (id: string, amount: number, status: Transaction['status'], action: Transaction['action'] = null) => ({
    ...txn(id, amount),
    status,
    action,
    pileId: status === 'piled' ? 'f' : null,
  })

  it('reads left to right: done, then still to do, then not reviewed', () => {
    const txns = [
      t('u', 1, 'unreviewed'),
      t('f', 2, 'flagged'),
      t('o', 3, 'piled', 'waiting'),
      t('s', 4, 'piled', 'done'),
      t('a', 5, 'approved'),
    ]
    expect(ledgerSegments(txns)).toEqual([
      { key: 'approve', amount: 5 },
      { key: 'settled', amount: 4 },
      { key: 'pile', amount: 3 },
      { key: 'flag', amount: 2 },
      { key: 'left', amount: 1 },
    ])
  })

  it('is one solid approved piece when nothing is left to do', () => {
    expect(ledgerSegments([t('a', 5, 'approved'), t('s', 4, 'piled', 'done')])).toEqual([{ key: 'approve', amount: 9 }])
  })

  it('counts a resolved flag as settled, and all clear once nothing else is left', () => {
    const txns = [t('a', 5, 'approved'), t('r', 2, 'flagged', 'done'), t('f', 1, 'flagged', 'waiting')]
    expect(ledgerSegments(txns)).toEqual([
      { key: 'approve', amount: 5 },
      { key: 'settled', amount: 2 },
      { key: 'flag', amount: 1 },
    ])
    expect(ledgerSegments(txns.slice(0, 2))).toEqual([{ key: 'approve', amount: 7 }])
  })

  it('leaves out empty pieces', () => {
    expect(ledgerSegments([t('a', 5, 'approved'), t('f', 2, 'flagged')]).map((s) => s.key)).toEqual(['approve', 'flag'])
  })
})
