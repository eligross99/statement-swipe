import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { initialLibrary, libraryReducer, type LibraryAction, type LibraryState } from '../lib/library'
import { loadLibrary, saveLibrary } from '../lib/storage'
import type { Statement } from '../types'

const SAVE_DELAY_MS = 400

/**
 * Every statement plus persistence: restores the saved statements on first load, then saves
 * shortly after every change, and right away if the page is hidden (e.g. the user switches apps
 * to answer a text), so nothing is lost if the phone closes the app in the background.
 * Only statements that changed are written, and deleted ones are removed.
 */
export function useLibrary() {
  const [state, dispatchEvent] = useReducer(libraryReducer, initialLibrary)
  /** Sends an action, stamped with the time so the reducer can record when a statement changed. */
  const dispatch = useCallback((action: LibraryAction) => dispatchEvent({ ...action, now: Date.now() }), [])
  const [ready, setReady] = useState(false)
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(state)
  // What IndexedDB holds, so each save knows what changed. Statements are never edited in place
  // (the reducers always make new objects), so "changed" means "a different object".
  const saved = useRef(new Map<string, Statement>())

  // Restore once on mount.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { statements, ui } = await loadLibrary()
      if (cancelled) return
      saved.current = new Map(statements.map((st) => [st.id, st]))
      dispatch({ type: 'loaded', statements, ui })
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [dispatch])

  const save = (s: LibraryState) => {
    const current = new Map(s.statements.map((st) => [st.id, st]))
    const put = s.statements.filter((st) => saved.current.get(st.id) !== st)
    const remove = [...saved.current.keys()].filter((id) => !current.has(id))
    saved.current = current
    void saveLibrary(put, remove, { openId: s.openId, view: s.view, filter: s.filter })
  }

  // Debounced save whenever anything changes.
  useEffect(() => {
    latest.current = state
    if (!ready) return
    pending.current = setTimeout(() => {
      pending.current = null
      save(state)
    }, SAVE_DELAY_MS)
    return () => {
      if (pending.current) clearTimeout(pending.current)
      pending.current = null
    }
  }, [ready, state])

  // Phones can kill a backgrounded tab at any time, so flush a pending save when the page hides.
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState !== 'hidden' || !pending.current) return
      clearTimeout(pending.current)
      pending.current = null
      save(latest.current)
    }
    document.addEventListener('visibilitychange', flush)
    return () => document.removeEventListener('visibilitychange', flush)
  }, [])

  return { ...state, ready, dispatch }
}
