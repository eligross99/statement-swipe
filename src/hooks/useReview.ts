import { useEffect, useReducer, useRef, useState } from 'react'
import { initialReviewState, reviewReducer } from '../lib/review'
import { loadSession, loadUndo, saveSession, saveUndo } from '../lib/storage'

const SAVE_DELAY_MS = 400

/**
 * The review state plus persistence: restores the saved session (and its undo steps) on first
 * load, then saves both to IndexedDB shortly after every change, and right away if the page is
 * hidden (e.g. the user switches apps to answer a text), so undo works as if they never left.
 */
export function useReview() {
  const [state, dispatch] = useReducer(reviewReducer, initialReviewState)
  const [ready, setReady] = useState(false)
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(state)

  // Restore once on mount.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const saved = await loadSession()
      const history = saved ? await loadUndo(saved) : []
      if (cancelled) return
      if (saved) dispatch({ type: 'restore', session: saved, history })
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Debounced save whenever the session or its undo steps change.
  useEffect(() => {
    latest.current = state
    if (!ready || !state.session.txns.length) return
    pending.current = setTimeout(() => {
      pending.current = null
      void saveSession(state.session)
      void saveUndo(state.history)
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
      void saveSession(latest.current.session)
      void saveUndo(latest.current.history)
    }
    document.addEventListener('visibilitychange', flush)
    return () => document.removeEventListener('visibilitychange', flush)
  }, [])

  return { ...state, ready, dispatch }
}
