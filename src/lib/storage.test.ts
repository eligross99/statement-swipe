import { get, set } from 'idb-keyval'
import type { Session } from '../types'
import { isSession, isUndoHistory, loadSession, loadUndo, saveSession } from './storage'

// Stand-in for IndexedDB: tests check what we store and how we read it back.
vi.mock('idb-keyval', () => ({ get: vi.fn(), set: vi.fn() }))

const session: Session = {
  txns: [
    { id: 't1', desc: 'SHOP', amount: 5, date: '', cat: '—', status: 'approved', pileId: null, action: null, note: '' },
  ],
  index: 1,
  piles: [{ id: 'f1', name: 'Ski trip' }],
  screen: 'summary',
  label: 'March',
  openPile: null,
}

beforeEach(() => {
  vi.mocked(get).mockReset()
  vi.mocked(set).mockReset()
})

describe('isSession', () => {
  it('accepts a well-formed session', () => {
    expect(isSession(session)).toBe(true)
  })

  it('rejects junk and partial shapes', () => {
    expect(isSession(null)).toBe(false)
    expect(isSession({ ...session, txns: 'nope' })).toBe(false)
    expect(isSession({ ...session, screen: 'elsewhere' })).toBe(false)
    expect(isSession({ ...session, txns: [{ ...session.txns[0], amount: '5' }] })).toBe(false)
    expect(isSession({ ...session, txns: [{ ...session.txns[0], status: 'maybe' }] })).toBe(false)
  })
})

describe('loadSession', () => {
  it('returns the saved session', async () => {
    vi.mocked(get).mockResolvedValue(session)
    await expect(loadSession()).resolves.toEqual(session)
  })

  it('returns null when nothing is saved, the save is corrupt, or it has no purchases', async () => {
    vi.mocked(get).mockResolvedValueOnce(undefined)
    await expect(loadSession()).resolves.toBeNull()
    vi.mocked(get).mockResolvedValueOnce({ garbage: true })
    await expect(loadSession()).resolves.toBeNull()
    vi.mocked(get).mockResolvedValueOnce({ ...session, txns: [] })
    await expect(loadSession()).resolves.toBeNull()
  })

  it('returns null if IndexedDB is unavailable', async () => {
    vi.mocked(get).mockRejectedValue(new Error('blocked'))
    await expect(loadSession()).resolves.toBeNull()
  })
})

describe('saveSession', () => {
  it('stores the whole session blob', async () => {
    vi.mocked(set).mockResolvedValue(undefined)
    await saveSession(session)
    expect(set).toHaveBeenCalledWith('statement-swipe-session-v1', session)
  })

  it('swallows storage errors so the app keeps working', async () => {
    vi.mocked(set).mockRejectedValue(new Error('quota'))
    await expect(saveSession(session)).resolves.toBeUndefined()
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

  it('loads an empty history when the saved one is unusable or storage fails', async () => {
    vi.mocked(get).mockResolvedValueOnce([{ ...step, txnId: 'other' }])
    await expect(loadUndo(session)).resolves.toEqual([])
    vi.mocked(get).mockRejectedValueOnce(new Error('blocked'))
    await expect(loadUndo(session)).resolves.toEqual([])
    vi.mocked(get).mockResolvedValueOnce([step])
    await expect(loadUndo(session)).resolves.toEqual([step])
  })
})
