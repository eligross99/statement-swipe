import { discardSharedFile, openedByShare, SHARE_CACHE, SHARED_FILE_URL, takeSharedFile } from './shareTarget'

// The service worker's side (public/share-target.js) runs in a real browser in e2e/share-target.spec.ts.

/** A stand-in for the browser's Cache Storage, holding at most one response per URL. */
function fakeCaches() {
  const store = new Map<string, Response>()
  const cache = {
    match: async (url: string) => store.get(url),
    put: async (url: string, res: Response) => void store.set(url, res),
    delete: async (url: string) => store.delete(url),
  }
  const opened: string[] = []
  const deleted: string[] = []
  vi.stubGlobal('caches', {
    open: async (name: string) => (opened.push(name), cache),
    delete: async (name: string) => (deleted.push(name), store.clear(), true),
  })
  return { cache, opened, deleted }
}

afterEach(() => vi.unstubAllGlobals())

describe('openedByShare', () => {
  it('spots the flag the service worker adds', () => {
    expect(openedByShare('?shared')).toBe(true)
    expect(openedByShare('?shared=1')).toBe(true)
    expect(openedByShare('')).toBe(false)
  })
})

describe('takeSharedFile', () => {
  it('returns the waiting file with its name and type, and removes it', async () => {
    const { cache, opened } = fakeCaches()
    const headers = { 'Content-Type': 'text/csv', 'X-File-Name': encodeURIComponent('July statement.csv') }
    await cache.put(SHARED_FILE_URL, new Response('Date,Amount\n', { headers }))

    const file = await takeSharedFile()
    expect(opened).toEqual([SHARE_CACHE])
    expect(file?.name).toBe('July statement.csv')
    expect(file?.type).toBe('text/csv')
    expect(await file?.text()).toBe('Date,Amount\n')
    expect(await cache.match(SHARED_FILE_URL)).toBeUndefined()
  })

  it('returns null when nothing is waiting, or the browser has no Cache Storage', async () => {
    fakeCaches()
    expect(await takeSharedFile()).toBeNull()
    vi.stubGlobal('caches', undefined)
    expect(await takeSharedFile()).toBeNull()
  })
})

describe('discardSharedFile', () => {
  it('removes the whole share cache', async () => {
    const { deleted } = fakeCaches()
    await discardSharedFile()
    expect(deleted).toEqual([SHARE_CACHE])
  })
})
