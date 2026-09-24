// Saves and restores statements in IndexedDB, the browser's on-device database, through Dexie
// (a small library that makes IndexedDB easier to use). Nothing here touches the network: the
// statements stay on this device.

import { Dexie, type Table } from 'dexie'
import { del, get } from 'idb-keyval'
import type { Session, Statement, UndoEntry } from '../types'
import type { SavedUi, Settings, Tab, View } from './library'
import { reviewScreen } from './review'
import { SAMPLE_LABEL } from './sample'
import { defaultName, statementPeriod, type StatementFilter } from './statements'
import { REMIND_CHOICES } from './tasks'

// ---------- shape checks, so a stale or corrupt save can't crash the app ----------

const STATUSES = new Set(['unreviewed', 'approved', 'piled', 'flagged'])
const SCREENS = new Set(['deck', 'summary', 'pile'])
const ACTIONS = new Set([null, 'todo', 'waiting', 'done'])
const VIEWS = new Set<View>(['statements', 'tasks', 'import', 'settings', 'review'])
const TABS = new Set<Tab | undefined>(['statements', 'tasks', undefined])
const REMIND_DAYS = new Set(REMIND_CHOICES.map((c) => c.days))
const FILTERS = new Set<StatementFilter>(['all', 'action', 'archived'])

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

/** The parts of a review every version of the app has saved the same way. */
function isReviewData(v: Record<string, unknown>): boolean {
  if (!Array.isArray(v.txns) || !Array.isArray(v.piles) || typeof v.index !== 'number') return false
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

export function isSession(v: unknown): v is Session {
  return isObject(v) && isReviewData(v) && SCREENS.has(v.screen as string)
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

export function isStatement(v: unknown): v is Statement {
  return (
    isObject(v) &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.addedAt === 'number' &&
    typeof v.updatedAt === 'number' &&
    (v.period === null || typeof v.period === 'string') &&
    typeof v.archived === 'boolean' &&
    isSession(v.session) &&
    v.session.txns.length > 0 &&
    isUndoHistory(v.history, v.session)
  )
}

function isSavedUi(v: unknown): v is SavedUi {
  return (
    isObject(v) &&
    VIEWS.has(v.view as View) &&
    FILTERS.has(v.filter as StatementFilter) &&
    TABS.has(v.home as Tab | undefined) &&
    (v.openId === null || typeof v.openId === 'string')
  )
}

/** Saved settings, keeping only fields we recognize with the right type (missing ones use defaults). */
export function readSettings(v: unknown): Partial<Settings> | null {
  if (!isObject(v)) return null
  const out: Partial<Settings> = {}
  if (typeof v.suggestFolders === 'boolean') out.suggestFolders = v.suggestFolders
  if (REMIND_DAYS.has(v.remindAfterDays as number | null)) out.remindAfterDays = v.remindAfterDays as number | null
  return out
}

// ---------- moving the single review saved before Phase 6b ----------

/** Before Phase 6b the app kept one review, under these keys in idb-keyval's database. */
export const LEGACY_SESSION_KEY = 'statement-swipe-session-v1'
export const LEGACY_UNDO_KEY = 'statement-swipe-undo-v1'
/** The id the moved review gets, so moving it twice can't make two copies. */
export const MIGRATED_ID = 'st_migrated'

/** Turns the old single saved review (and its undo steps) into the first saved statement. */
export function migrateLegacy(session: unknown, undo: unknown, now: number): Statement | null {
  // Old saves also had a `label` (the file name) and could be on the import screen.
  if (!isObject(session) || !isReviewData(session) || typeof session.label !== 'string') return null
  const screen = session.screen as string
  if (!SCREENS.has(screen) && screen !== 'import') return null
  const { txns, index, piles, openPile } = session as unknown as Session
  if (!txns.length) return null
  const base: Session = { txns, index, piles, screen: 'deck', openPile }
  const restored: Session = { ...base, screen: screen === 'import' ? reviewScreen(base) : (screen as Session['screen']) }
  const period = statementPeriod(txns)
  return {
    id: MIGRATED_ID,
    // The sample keeps its name; a real statement gets its month instead of its file name.
    name: session.label === SAMPLE_LABEL ? SAMPLE_LABEL : defaultName(period, session.label, []),
    addedAt: now,
    updatedAt: now,
    period,
    archived: false,
    session: restored,
    history: isUndoHistory(undo, restored) ? undo : [],
  }
}

// ---------- the database ----------

class StatementsDb extends Dexie {
  statements!: Table<Statement, string>
  /** Small app settings, stored by name (e.g. "ui"). */
  prefs!: Table<unknown, string>

  constructor() {
    super('statement-swipe')
    this.version(1).stores({ statements: 'id', prefs: '' })
  }
}

// Opened on first use, not when this file loads, so tests and old browsers can't fail at startup.
let instance: StatementsDb | null = null
const db = () => (instance ??= new StatementsDb())

const UI_KEY = 'ui'
const SETTINGS_KEY = 'settings'

/** Moves a review saved before Phase 6b into the statements table, once, then removes the old copy. */
async function migrate(): Promise<void> {
  const legacy = await get(LEGACY_SESSION_KEY)
  if (legacy === undefined) return
  const moved = migrateLegacy(legacy, await get(LEGACY_UNDO_KEY), Date.now())
  if (moved && !(await db().statements.get(MIGRATED_ID))) {
    await db().transaction('rw', db().statements, db().prefs, async () => {
      await db().statements.add(moved)
      // Open it, so the user lands exactly where they were.
      await db().prefs.put({ openId: moved.id, view: 'review', filter: 'all' } satisfies SavedUi, UI_KEY)
    })
  }
  // Only once the statement is safely saved above (or there was nothing usable to move).
  await del(LEGACY_SESSION_KEY)
  await del(LEGACY_UNDO_KEY)
}

export interface SavedLibrary {
  statements: Statement[]
  ui: SavedUi | null
  settings: Partial<Settings> | null
}

/** Every saved statement and where the user was. Empty if IndexedDB can't be used. */
export async function loadLibrary(): Promise<SavedLibrary> {
  try {
    await migrate().catch(() => undefined) // a failed move leaves the old copy to try again next time
    const [rows, ui, settings] = await Promise.all([
      db().statements.toArray(),
      db().prefs.get(UI_KEY),
      db().prefs.get(SETTINGS_KEY),
    ])
    return { statements: rows.filter(isStatement), ui: isSavedUi(ui) ? ui : null, settings: readSettings(settings) }
  } catch {
    return { statements: [], ui: null, settings: null } // IndexedDB unavailable (e.g. some private-browsing modes): start fresh
  }
}

/** Saves changed statements, removes deleted ones, and remembers where the user is and their
 *  settings, all at once. */
export async function saveLibrary(put: Statement[], remove: string[], ui: SavedUi, settings: Settings): Promise<void> {
  if (put.length) void requestPersistentStorage()
  try {
    await db().transaction('rw', db().statements, db().prefs, async () => {
      if (put.length) await db().statements.bulkPut(put)
      if (remove.length) await db().statements.bulkDelete(remove)
      await db().prefs.put(ui, UI_KEY)
      await db().prefs.put(settings, SETTINGS_KEY)
    })
  } catch {
    // Saving is best-effort; the app keeps working in memory.
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

/** Whether the browser has promised not to clear our data on its own. Null if it can't say. */
export async function isStoragePersisted(): Promise<boolean | null> {
  try {
    return navigator.storage?.persisted ? await navigator.storage.persisted() : null
  } catch {
    return null
  }
}
