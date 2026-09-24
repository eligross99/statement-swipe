// The app's top-level state machine: every saved statement, which one is open, and which screen
// is showing. Changes to one statement's review are handed to `reviewReducer` (review.ts).
// Like the review reducer, it's a plain function with no React, so it's easy to unit test.

import type { Statement, Transaction } from '../types'
import { newReview, reviewReducer, reviewScreen, type ReviewEvent } from './review'
import type { StatementFilter } from './statements'

/** The places in the bottom tab bar. */
export type Tab = 'statements' | 'tasks'

/** The app's top-level places. "review" is one statement's deck, summary, or folder. */
export type View = Tab | 'import' | 'settings' | 'review'

/** The user's preferences, changed on the Settings screen. */
export interface Settings {
  /** When filing, offer folder names used in past statements (folders themselves are never shared). */
  suggestFolders: boolean
  /** Open tasks untouched for this many days are marked Overdue (null = never). */
  remindAfterDays: number | null
}

export const defaultSettings: Settings = { suggestFolders: true, remindAfterDays: 14 }

export interface LibraryState {
  statements: Statement[]
  openId: string | null
  view: View
  /** The tab the user was last on, where Back returns from a review, import, or Settings. */
  home: Tab
  /** The Statements screen's filter, remembered between visits. */
  filter: StatementFilter
  settings: Settings
}

/** What's saved beside the statements, so the app reopens where the user left it. */
export interface SavedUi {
  openId: string | null
  view: View
  filter: StatementFilter
  /** Missing in saves from before the Tasks tab. */
  home?: Tab
}

/** Something the user (or loading) did. */
export type LibraryAction =
  | { type: 'loaded'; statements: Statement[]; ui: SavedUi | null; settings: Partial<Settings> | null }
  | { type: 'add'; id: string; txns: Transaction[]; name: string; period: string | null }
  | { type: 'open'; id: string }
  /** Opens a statement straight to one of its folders (from Tasks). */
  | { type: 'openFolder'; id: string; pileId: string }
  | { type: 'go'; view: Exclude<View, 'review'> }
  | { type: 'rename'; id: string; name: string }
  | { type: 'archive'; id: string; archived: boolean }
  | { type: 'delete'; id: string }
  | { type: 'eraseAll' }
  | { type: 'setFilter'; filter: StatementFilter }
  | { type: 'setSettings'; settings: Partial<Settings> }
  /** A change to the open statement's review, or to statement `id` (e.g. a status set from Tasks). */
  | { type: 'review'; event: ReviewEvent; id?: string }

/** An action plus when it happened (added by `useLibrary`), so the reducer itself stays pure. */
export type LibraryEvent = LibraryAction & { now: number }

export const initialLibrary: LibraryState = {
  statements: [],
  openId: null,
  view: 'statements',
  home: 'statements',
  filter: 'all',
  settings: defaultSettings,
}

/** A statement for newly imported purchases, ready to review. */
export function makeStatement(
  txns: Transaction[],
  { id, name, period, now }: { id: string; name: string; period: string | null; now: number },
): Statement {
  return { id, name, period, addedAt: now, updatedAt: now, archived: false, ...newReview(txns) }
}

export function openStatement(state: LibraryState): Statement | null {
  return state.view === 'review' ? (state.statements.find((st) => st.id === state.openId) ?? null) : null
}

function patch(state: LibraryState, id: string, change: (st: Statement) => Statement): LibraryState {
  return { ...state, statements: state.statements.map((st) => (st.id === id ? change(st) : st)) }
}

export function libraryReducer(state: LibraryState, event: LibraryEvent): LibraryState {
  switch (event.type) {
    case 'loaded': {
      const { statements, ui, settings } = event
      // Reopen the review the user was in, if it still exists; otherwise start on Statements.
      const open = ui?.view === 'review' ? statements.find((st) => st.id === ui.openId) : undefined
      const home = ui?.home ?? 'statements'
      return {
        statements,
        openId: open?.id ?? null,
        view: open ? 'review' : home,
        home,
        filter: ui?.filter ?? 'all',
        settings: { ...defaultSettings, ...settings },
      }
    }

    case 'add': {
      // A new statement opens straight away, on its first card.
      const { id, txns, name, period, now } = event
      const added = makeStatement(txns, { id, name, period, now })
      return { ...state, statements: [...state.statements, added], openId: id, view: 'review' }
    }

    case 'open': {
      const st = state.statements.find((s) => s.id === event.id)
      if (!st) return state
      // Opens at the first card (new), where the user left off (in progress), or the summary (done).
      const opened = { ...st, session: { ...st.session, screen: reviewScreen(st.session), openPile: null } }
      return { ...patch(state, st.id, () => opened), openId: st.id, view: 'review' }
    }

    case 'openFolder': {
      const st = state.statements.find((s) => s.id === event.id)
      if (!st?.session.piles.some((p) => p.id === event.pileId)) return state
      const opened = { ...st, session: { ...st.session, screen: 'pile' as const, openPile: event.pileId } }
      return { ...patch(state, st.id, () => opened), openId: st.id, view: 'review' }
    }

    case 'go': {
      const { view } = event
      const home = view === 'statements' || view === 'tasks' ? view : state.home
      return { ...state, view, openId: null, home }
    }

    case 'rename': {
      const name = event.name.trim()
      if (!name) return state
      return patch(state, event.id, (st) => ({ ...st, name, updatedAt: event.now }))
    }

    case 'archive':
      return patch(state, event.id, (st) => ({ ...st, archived: event.archived, updatedAt: event.now }))

    case 'delete': {
      const closing = state.openId === event.id
      return {
        ...state,
        statements: state.statements.filter((st) => st.id !== event.id),
        openId: closing ? null : state.openId,
        view: closing ? 'statements' : state.view,
      }
    }

    case 'eraseAll':
      // Statements go; preferences (settings, the chosen filter, the last tab) stay.
      return { ...initialLibrary, home: state.home, filter: state.filter, settings: state.settings }

    case 'setFilter':
      return { ...state, filter: event.filter }

    case 'setSettings':
      return { ...state, settings: { ...state.settings, ...event.settings } }

    case 'review': {
      const st = event.id ? state.statements.find((s) => s.id === event.id) : openStatement(state)
      if (!st) return state
      const next = reviewReducer({ session: st.session, history: st.history }, event.event, event.now)
      if (next.session === st.session && next.history === st.history) return state
      return patch(state, st.id, () => ({ ...st, ...next, updatedAt: event.now }))
    }
  }
}
