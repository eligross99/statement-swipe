import { useEffect, useReducer, useRef, useState } from 'react'
import { initialReviewState, reviewReducer } from '../lib/review'
import { loadSession, saveSession } from '../lib/storage'

const SAVE_DELAY_MS = 400

/**
 * The review state plus persistence: restores the saved session on first load, then saves
 * the whole session to IndexedDB shortly after every change (and right away if the page is hidden).
 */
export function useReview() {
  const [state, dispatch] = useReducer(reviewReducer, initialReviewState)
  const [ready, setReady] = useState(false)
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(state.session)

  // Restore once on mount.
  useEffect(() => {
    let cancelled = false
    loadSession().then((saved) => {
      if (cancelled) return
      if (saved) dispatch({ type: 'restore', session: saved })
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Debounced save whenever the session changes.
  useEffect(() => {
    latest.current = state.session
    if (!ready || !state.session.txns.length) return
    pending.current = setTimeout(() => {
      pending.current = null
      void saveSession(state.session)
    }, SAVE_DELAY_MS)
    return () => {
      if (pending.current) clearTimeout(pending.current)
      pending.current = null
    }
  }, [ready, state.session])

  // Phones can kill a backgrounded tab at any time, so flush a pending save when the page hides.
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState !== 'hidden' || !pending.current) return
      clearTimeout(pending.current)
      pending.current = null
      void saveSession(latest.current)
    }
    document.addEventListener('visibilitychange', flush)
    return () => document.removeEventListener('visibilitychange', flush)
  }, [])

  return { ...state, ready, dispatch }
}
