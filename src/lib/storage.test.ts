import type { Session, Statement } from '../types'
import { SAMPLE_LABEL } from './sample'
import { isSession, isStatement, isUndoHistory, migrateLegacy, MIGRATED_ID, readSettings } from './storage'

// Reading and writing the real database runs in a browser, in e2e/statements.spec.ts. These tests
// cover the checks that keep a corrupt save from crashing the app, and moving the old saved review.

const session: Session = {
  txns: [
    { id: 't1', desc: 'SHOP', amount: 5, date: '2026-07-02', cat: '—', status: 'approved', pileId: null, action: null, note: '' },
    { id: 't2', desc: 'CAFE', amount: 3, date: '2026-07-11', cat: '—', status: 'unreviewed', pileId: null, action: null, note: '' },
  ],
  index: 1,
  piles: [{ id: 'f1', name: 'Ski trip' }],
  screen: 'deck',
  openPile: null,
}

const statement: Statement = {
  id: 'st_1',
  name: 'July 2026',
  addedAt: 1,
  updatedAt: 2,
  period: '2026-07-11',
  archived: false,
  session,
  history: [{ txnId: 't1', index: 0, status: 'unreviewed', pileId: null }],
}

describe('isSession', () => {
  it('accepts a well-formed session', () => {
    expect(isSession(session)).toBe(true)
  })

  it('rejects junk and partial shapes', () => {
    expect(isSession(null)).toBe(false)
    expect(isSession({ ...session, txns: 'nope' })).toBe(false)
    expect(isSession({ ...session, screen: 'import' })).toBe(false)
    expect(isSession({ ...session, txns: [{ ...session.txns[0], amount: '5' }] })).toBe(false)
    expect(isSession({ ...session, txns: [{ ...session.txns[0], status: 'maybe' }] })).toBe(false)
  })
})

describe('isStatement', () => {
  it('accepts a well-formed statement', () => {
    expect(isStatement(statement)).toBe(true)
    expect(isStatement({ ...statement, period: null })).toBe(true)
  })

  it('rejects missing fields, empty statements, and undo steps from another review', () => {
    expect(isStatement({ ...statement, name: undefined })).toBe(false)
    expect(isStatement({ ...statement, archived: 'no' })).toBe(false)
    expect(isStatement({ ...statement, session: { ...session, txns: [] } })).toBe(false)
    expect(isStatement({ ...statement, history: [{ txnId: 'other', index: 0, status: 'unreviewed', pileId: null }] })).toBe(
      false,
    )
  })
})

describe('undo history', () => {
  const step = { txnId: 't1', index: 0, status: 'unreviewed', pileId: null }

  it('accepts steps that point at purchases in this session', () => {
    expect(isUndoHistory([step], session)).toBe(true)
    expect(isUndoHistory([], session)).toBe(true)
  })

  it('rejects junk and steps from another review', () => {
    expect(isUndoHistory(null, session)).toBe(false)
    expect(isUndoHistory([{ ...step, txnId: 'other' }], session)).toBe(false)
    expect(isUndoHistory([{ ...step, index: 5 }], session)).toBe(false)
    expect(isUndoHistory([{ ...step, status: 'maybe' }], session)).toBe(false)
  })
})

describe('migrateLegacy', () => {
  // The single review saved before Phase 6b: a session with the file name as its label.
  const legacy = { ...session, label: 'eStmt_2026-07-13' }
  const undo = [{ txnId: 't1', index: 0, status: 'unreviewed', pileId: null }]

  it('turns the old saved review into a statement named for its month, keeping undo', () => {
    const st = migrateLegacy(legacy, undo, 1000)
    expect(st).toEqual({
      id: MIGRATED_ID,
      name: 'July 2026',
      addedAt: 1000,
      updatedAt: 1000,
      period: '2026-07-11',
      archived: false,
      session,
      history: undo,
    })
    expect(isStatement(st)).toBe(true)
  })

  it('keeps the sample’s name, and the file name when there are no dates', () => {
    expect(migrateLegacy({ ...legacy, label: SAMPLE_LABEL }, undo, 0)?.name).toBe(SAMPLE_LABEL)
    const undated = { ...legacy, txns: legacy.txns.map((t) => ({ ...t, date: '' })) }
    expect(migrateLegacy(undated, undo, 0)?.name).toBe('eStmt_2026-07-13')
  })

  it('reopens a review that was saved on the import screen', () => {
    expect(migrateLegacy({ ...legacy, screen: 'import' }, undo, 0)?.session.screen).toBe('deck')
    const finished = { ...legacy, index: 2, screen: 'import' }
    expect(migrateLegacy(finished, [], 0)?.session.screen).toBe('summary')
  })

  it('drops unusable undo steps but keeps the review', () => {
    expect(migrateLegacy(legacy, [{ txnId: 'gone' }], 0)?.history).toEqual([])
    expect(migrateLegacy(legacy, undefined, 0)?.history).toEqual([])
  })

  it('moves nothing when the old save is missing, corrupt, or empty', () => {
    expect(migrateLegacy(undefined, undefined, 0)).toBeNull()
    expect(migrateLegacy({ garbage: true }, undefined, 0)).toBeNull()
    expect(migrateLegacy({ ...legacy, txns: [] }, undefined, 0)).toBeNull()
    expect(migrateLegacy({ ...legacy, label: undefined }, undefined, 0)).toBeNull()
  })
})

describe('readSettings', () => {
  it('keeps recognized settings and drops junk, so defaults fill the gaps', () => {
    expect(readSettings({ suggestFolders: false })).toEqual({ suggestFolders: false })
    expect(readSettings({ suggestFolders: 'no', other: 1 })).toEqual({})
    expect(readSettings({ remindAfterDays: 30 })).toEqual({ remindAfterDays: 30 })
    expect(readSettings({ remindAfterDays: null })).toEqual({ remindAfterDays: null })
    expect(readSettings({ remindAfterDays: 5 })).toEqual({})
    expect(readSettings(undefined)).toBeNull()
  })
})

describe('requestPersistentStorage', () => {
  it('asks the browser to keep our data, only once per page load', async () => {
    vi.resetModules()
    const { requestPersistentStorage } = await import('./storage')
    const persist = vi.fn().mockResolvedValue(true)
    const persisted = vi.fn().mockResolvedValue(false)
    vi.stubGlobal('navigator', { storage: { persist, persisted } })

    expect(await requestPersistentStorage()).toBe(true)
    expect(await requestPersistentStorage()).toBe(false)
    expect(persist).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })

  it('does nothing where the browser has no storage manager', async () => {
    vi.resetModules()
    const { requestPersistentStorage } = await import('./storage')
    vi.stubGlobal('navigator', {})
    expect(await requestPersistentStorage()).toBe(false)
    vi.unstubAllGlobals()
  })
})
