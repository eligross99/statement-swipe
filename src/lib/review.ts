// The review state machine. Every change to the session goes through `reviewReducer`, a plain
// function (old state + event → new state) with no React in it, so it's easy to unit test.

import type { Action, Pile, Screen, Session, Status, Transaction, UndoEntry } from '../types'

export type { UndoEntry }

export interface ReviewState {
  session: Session
  history: UndoEntry[]
}

export type ReviewEvent =
  | { type: 'approve' }
  | { type: 'flag' }
  | { type: 'approveFlagged'; txnId: string }
  | { type: 'file'; pileId: string }
  | { type: 'createPileAndFile'; pile: Pile }
  | { type: 'deletePile'; pileId: string }
  | { type: 'undo' }
  | { type: 'restart' }
  | { type: 'openPile'; pileId: string }
  | { type: 'closePile' }
  | { type: 'setAction'; txnId: string; action: Action }
  | { type: 'setNote'; txnId: string; note: string }

/** Fresh, unreviewed copies of transactions: used when starting or restarting a review. */
function resetTxns(txns: Transaction[]): Transaction[] {
  return txns.map((t) => ({ ...t, status: 'unreviewed', pileId: null, action: null, note: '' }))
}

/** A new review of `txns`, on the first card with no folders. */
export function newReview(txns: Transaction[]): ReviewState {
  return {
    session: { txns: resetTxns(txns), index: 0, piles: [], screen: 'deck', openPile: null },
    history: [],
  }
}

/** Where the user lands when opening a statement: the deck if cards remain, else the summary. */
export function reviewScreen(s: Session): Screen {
  return s.index >= s.txns.length ? 'summary' : 'deck'
}

/** Marks the current card with a terminal status and advances; moves to the summary after the last card. */
function resolveCurrent(state: ReviewState, status: Status, pileId: string | null): ReviewState {
  const s = state.session
  const current = s.txns[s.index]
  if (s.screen !== 'deck' || !current) return state
  const index = s.index + 1
  return {
    session: {
      ...s,
      txns: s.txns.map((t, i) => (i === s.index ? { ...t, status, pileId } : t)),
      index,
      screen: index >= s.txns.length ? 'summary' : 'deck',
    },
    history: [
      ...state.history,
      { txnId: current.id, index: s.index, status: current.status, pileId: current.pileId },
    ],
  }
}

function patchTxn(state: ReviewState, id: string, patch: Partial<Transaction>): ReviewState {
  const s = state.session
  return { ...state, session: { ...s, txns: s.txns.map((t) => (t.id === id ? { ...t, ...patch } : t)) } }
}

export function reviewReducer(state: ReviewState, event: ReviewEvent): ReviewState {
  const s = state.session
  switch (event.type) {
    case 'approve':
      return resolveCurrent(state, 'approved', null)

    case 'flag':
      return resolveCurrent(state, 'flagged', null)

    case 'approveFlagged': {
      // After looking into a flagged purchase from the summary, the user recognizes it after all.
      const txn = s.txns.find((t) => t.id === event.txnId)
      if (!txn || txn.status !== 'flagged') return state
      return patchTxn(state, event.txnId, { status: 'approved' })
    }

    case 'file':
      if (!s.piles.some((p) => p.id === event.pileId)) return state
      return resolveCurrent(state, 'piled', event.pileId)

    case 'createPileAndFile': {
      if (s.screen !== 'deck' || !s.txns[s.index]) return state
      const withPile = { ...state, session: { ...s, piles: [...s.piles, event.pile] } }
      return resolveCurrent(withPile, 'piled', event.pile.id)
    }

    case 'deletePile': {
      // Items in a deleted folder go back to "approved" so their review is never lost.
      const txns = s.txns.map((t) =>
        t.pileId === event.pileId
          ? { ...t, pileId: null, status: t.status === 'piled' ? ('approved' as const) : t.status }
          : t,
      )
      const closingOpen = s.openPile === event.pileId
      return {
        ...state,
        session: {
          ...s,
          txns,
          piles: s.piles.filter((p) => p.id !== event.pileId),
          openPile: closingOpen ? null : s.openPile,
          screen: closingOpen && s.screen === 'pile' ? 'summary' : s.screen,
        },
      }
    }

    case 'undo': {
      // Allowed from the deck and the summary (so the very last card can be undone too).
      const last = state.history[state.history.length - 1]
      if (!last || (s.screen !== 'deck' && s.screen !== 'summary')) return state
      return {
        session: {
          ...s,
          // Only this card's review fields roll back; notes and triage elsewhere are untouched.
          txns: s.txns.map((t) => (t.id === last.txnId ? { ...t, status: last.status, pileId: last.pileId } : t)),
          index: last.index,
          screen: 'deck',
        },
        history: state.history.slice(0, -1),
      }
    }

    case 'restart':
      if (!s.txns.length) return state
      return {
        session: { ...s, txns: resetTxns(s.txns), index: 0, piles: [], screen: 'deck', openPile: null },
        history: [],
      }

    case 'openPile':
      if (!s.piles.some((p) => p.id === event.pileId)) return state
      return { ...state, session: { ...s, screen: 'pile', openPile: event.pileId } }

    case 'closePile':
      return { ...state, session: { ...s, screen: 'summary', openPile: null } }

    case 'setAction':
      return patchTxn(state, event.txnId, { action: event.action })

    case 'setNote':
      return patchTxn(state, event.txnId, { note: event.note })
  }
}

// ---------- selectors: values derived from a session, never stored ----------

export function currentTxn(s: Session): Transaction | null {
  return s.screen === 'deck' ? (s.txns[s.index] ?? null) : null
}

export function reviewedCount(txns: Transaction[]): number {
  return txns.filter((t) => t.status !== 'unreviewed').length
}

export function sumAmounts(txns: Transaction[]): number {
  return txns.reduce((sum, t) => sum + t.amount, 0)
}

/** The purchases currently filed in a folder. */
export function pileItems(txns: Transaction[], pileId: string): Transaction[] {
  return txns.filter((t) => t.pileId === pileId && t.status === 'piled')
}

/** Folder total that still needs follow-up: everything not marked Done. */
export function stillToActOn(items: Transaction[]): number {
  return sumAmounts(openItems(items))
}

/** Folder items that still need follow-up (not marked Done). */
export function openItems(items: Transaction[]): Transaction[] {
  return items.filter((t) => t.action !== 'done')
}

export interface FolderGroup {
  pile: Pile
  items: Transaction[]
  /** How many purchases still need action (status not Done). */
  open: number
}

/** Folders that have purchases, for the summary. Folders still needing action come first, so none
 *  get forgotten below the fold; settled ones sink to the bottom. Otherwise creation order. */
export function folderGroups(txns: Transaction[], piles: Pile[]): FolderGroup[] {
  const groups = piles
    .map((pile) => {
      const items = pileItems(txns, pile.id)
      return { pile, items, open: openItems(items).length }
    })
    .filter((g) => g.items.length > 0)
  // A stable sort keeps creation order within each half.
  return groups.sort((a, b) => Number(a.open === 0) - Number(b.open === 0))
}

/** The triage statuses, in the order the "Set status" menu lists them. */
export const ACTION_LABELS: Record<Exclude<Action, null>, string> = {
  todo: 'To do',
  waiting: 'Waiting',
  done: 'Done',
}
