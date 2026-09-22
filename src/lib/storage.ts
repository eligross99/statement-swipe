// Saves and restores the review session in IndexedDB, the browser's on-device database.
// Nothing here touches the network: the statement stays on this device.

import { get, set } from 'idb-keyval'
import type { Session } from '../types'

const STORE_KEY = 'statement-swipe-session-v1'

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

export async function saveSession(session: Session): Promise<void> {
  try {
    await set(STORE_KEY, session)
  } catch {
    // Saving is best-effort; the app keeps working in memory.
  }
}
