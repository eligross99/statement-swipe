// "Share to Statement Swipe" on Android. The installed app is listed as a share target in the web-app
// manifest (vite.config.ts). When the user shares a statement from Files or Downloads, Android sends it
// to the app's service worker (public/share-target.js), which keeps it in the browser's on-device Cache
// Storage and opens the app at `/?shared`. The app then takes the file from there with
// `takeSharedFile` and opens the Import screen with it. Nothing is uploaded; the file never leaves the
// phone. iPhone doesn't let web apps receive shared files, so there this never runs.
//
// The names below are repeated in public/share-target.js, which can't import them. Keep them in sync.

export const SHARE_CACHE = 'statement-swipe-shared'
export const SHARED_FILE_URL = '/shared-file'
/** Present in the URL when the app was opened with a shared file waiting. */
export const SHARED_PARAM = 'shared'

/** Whether the app was opened by a share (so there's a file waiting). */
export function openedByShare(search: string): boolean {
  return new URLSearchParams(search).has(SHARED_PARAM)
}

/** Takes the waiting shared file out of storage, or null if there isn't one. */
export async function takeSharedFile(): Promise<File | null> {
  if (typeof caches === 'undefined') return null
  try {
    const cache = await caches.open(SHARE_CACHE)
    const res = await cache.match(SHARED_FILE_URL)
    if (!res) return null
    await cache.delete(SHARED_FILE_URL)
    const name = decodeURIComponent(res.headers.get('X-File-Name') ?? '') || 'Shared statement'
    return new File([await res.blob()], name, { type: res.headers.get('Content-Type') ?? '' })
  } catch {
    return null
  }
}

/** Removes a shared file that was never opened (e.g. when erasing everything). */
export async function discardSharedFile(): Promise<void> {
  if (typeof caches === 'undefined') return
  try {
    await caches.delete(SHARE_CACHE)
  } catch {
    // Nothing to remove, or storage is off.
  }
}
