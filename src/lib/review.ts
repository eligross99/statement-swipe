// The review state machine. Every change to the session goes through `reviewReducer`, a plain
// function (old state + event → new state) with no React in it, so it's easy to unit test.

import type { Action, Pile, Screen, Session, Status, Transaction } from '../types'

/** What undo needs to put one resolved card back. Kept in memory only, not persisted. */
export interface UndoEntry {
  txnId: string
  index: number
  status: Status
  pileId: string | null
}

export interface ReviewState {
  session: Session
  history: UndoEntry[]
}

export type ReviewEvent =
  | { type: 'restore'; session: Session }
  | { type: 'start'; txns: Transaction[]; label: string }
  | { type: 'approve' }
  | { type: 'flag' }
  | { type: 'file'; pileId: string }
  | { type: 'createPileAndFile'; pile: Pile }
  | { type: 'deletePile'; pileId: string }
  | { type: 'undo' }
  | { type: 'restart' }
  | { type: 'goImport' }
  | { type: 'resume' }
  | { type: 'openPile'; pileId: string }
  | { type: 'closePile' }
  | { type: 'setAction'; txnId: string; action: Action }
  | { type: 'setNote'; txnId: string; note: string }

export const emptySession: Session = {
  txns: [],
  index: 0,
  piles: [],
  screen: 'import',
  label: '',
  openPile: null,
}

export const initialReviewState: ReviewState = { session: emptySession, history: [] }

/** Fresh, unreviewed copies of transactions: used when starting or restarting a review. */
function resetTxns(txns: Transaction[]): Transaction[] {
  return txns.map((t) => ({ ...t, status: 'unreviewed', pileId: null, action: null, note: '' }))
}

/** Where the user lands when returning to a session: the deck if cards remain, else the summary. */
function reviewScreen(s: Session): Screen {
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
    case 'restore':
      // A saved session never reopens on the import screen; send the user back to their review.
      return {
        session: { ...event.session, screen: event.session.screen === 'import' ? reviewScreen(event.session) : event.session.screen },
        history: [],
      }

    case 'start':
      return {
        session: { txns: resetTxns(event.txns), index: 0, piles: [], screen: 'deck', label: event.label, openPile: null },
        history: [],
      }

    case 'approve':
      return resolveCurrent(state, 'approved', null)

    case 'flag':
      return resolveCurrent(state, 'flagged', null)

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

    case 'goImport':
      return { ...state, session: { ...s, screen: 'import', openPile: null } }

    case 'resume':
      if (!s.txns.length) return state
      return { ...state, session: { ...s, screen: reviewScreen(s) } }

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
  return sumAmounts(items.filter((t) => t.action !== 'done'))
}

const ACTION_CYCLE: Action[] = [null, 'todo', 'waiting', 'done']

/** Tapping the status pill steps through: none → To do → Waiting → Done → none. */
export function nextAction(a: Action): Action {
  return ACTION_CYCLE[(ACTION_CYCLE.indexOf(a) + 1) % ACTION_CYCLE.length]
}
