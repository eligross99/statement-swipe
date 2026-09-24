// Saves and restores the review session in IndexedDB, the browser's on-device database.
// Nothing here touches the network: the statement stays on this device.

import { get, set } from 'idb-keyval'
import type { Session } from '../types'
import type { UndoEntry } from './review'

const STORE_KEY = 'statement-swipe-session-v1'
/** Undo history lives beside the session (not inside it), so the session's saved shape is unchanged. */
const UNDO_KEY = 'statement-swipe-undo-v1'

const STATUSES = new Set(['unreviewed', 'approved', 'piled', 'flagged'])
const SCREENS = new Set(['import', 'deck', 'summary', 'pile'])
const ACTIONS = new Set([null, 'todo', 'waiting', 'done'])

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

/** Checks a saved blob has the shape we expect, so a stale or corrupt save can't crash the app. */
export function isSession(v: unknown): v is Session {
  if (!isObject(v) || !Array.isArray(v.txns) || !Array.isArray(v.piles)) return false
  if (typeof v.index !== 'number' || typeof v.label !== 'string' || !SCREENS.has(v.screen as string)) return false
  if (v.openPile !== null && typeof v.openPile !== 'string') return false
  const txnsOk = v.txns.every(
    (t) =>
      isObject(t) &&
      typeof t.id === 'string' &&
      typeof t.desc === 'string' &&
      typeof t.amount === 'number' &&
      typeof t.note === 'string' &&
      STATUSES.has(t.status as string) &&
      ACTIONS.has(t.action as string | null) &&
      (t.pileId === null || typeof t.pileId === 'string'),
  )
  const pilesOk = v.piles.every((p) => isObject(p) && typeof p.id === 'string' && typeof p.name === 'string')
  return txnsOk && pilesOk
}

/** The saved session, or null if there isn't a usable one. */
export async function loadSession(): Promise<Session | null> {
  try {
    const saved: unknown = await get(STORE_KEY)
    return isSession(saved) && saved.txns.length > 0 ? saved : null
  } catch {
    return null // IndexedDB unavailable (e.g. some private-browsing modes): start fresh
  }
}

let persistRequested = false

/**
 * Asks the browser to treat our saved data as important. Without this, browsers may clear a
 * site's storage when the device is low on space, and Safari clears it after about a week of
 * not visiting. Installed (home-screen) apps are usually granted this automatically.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (persistRequested) return false
  persistRequested = true
  try {
    if (!navigator.storage?.persist) return false
    return (await navigator.storage.persisted()) || (await navigator.storage.persist())
  } catch {
    return false
  }
}

export async function saveSession(session: Session): Promise<void> {
  void requestPersistentStorage()
  try {
    await set(STORE_KEY, session)
  } catch {
    // Saving is best-effort; the app keeps working in memory.
  }
}

/** Checks saved undo steps are well formed and still point at purchases in this session. */
export function isUndoHistory(v: unknown, session: Session): v is UndoEntry[] {
  if (!Array.isArray(v)) return false
  const ids = new Set(session.txns.map((t) => t.id))
  return v.every(
    (e) =>
      isObject(e) &&
      typeof e.txnId === 'string' &&
      ids.has(e.txnId) &&
      typeof e.index === 'number' &&
      e.index >= 0 &&
      e.index < session.txns.length &&
      STATUSES.has(e.status as string) &&
      (e.pileId === null || typeof e.pileId === 'string'),
  )
}

/** The saved undo steps for `session`, so undo still works after leaving and reopening the app.
 *  Anything unusable (missing, corrupt, from another review) gives an empty history. */
export async function loadUndo(session: Session): Promise<UndoEntry[]> {
  try {
    const saved: unknown = await get(UNDO_KEY)
    return isUndoHistory(saved, session) ? saved : []
  } catch {
    return []
  }
}

export async function saveUndo(history: UndoEntry[]): Promise<void> {
  try {
    await set(UNDO_KEY, history)
  } catch {
    // Best-effort, like the session.
  }
}
