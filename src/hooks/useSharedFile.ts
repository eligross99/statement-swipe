import { useEffect, useRef, useState } from 'react'
import type { LibraryAction } from '../lib/library'
import { openedByShare, takeSharedFile } from '../lib/shareTarget'

/**
 * A statement shared to the app from Android's Share menu (see lib/shareTarget). Once saved statements
 * have loaded (`ready`), it takes the waiting file and opens the Import screen, which reads it. Returns
 * the file (null once the Import screen has taken it) and a way to clear it.
 */
export function useSharedFile(ready: boolean, send: (action: LibraryAction) => void) {
  const [file, setFile] = useState<File | null>(null)
  const handled = useRef(false)
  useEffect(() => {
    if (!ready || handled.current || !openedByShare(window.location.search)) return
    handled.current = true
    // Drop "?shared" so reloading later doesn't look for the file again.
    window.history.replaceState(null, '', window.location.pathname)
    void takeSharedFile().then((f) => {
      setFile(f)
      send({ type: 'go', view: 'import' })
    })
  }, [ready, send])
  return [file, () => setFile(null)] as const
}
