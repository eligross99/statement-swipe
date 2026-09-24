import { useEffect, useState } from 'react'

const MINUTE_MS = 60_000

/** The current time, refreshed every minute and whenever the user comes back to the app (it may
 *  have sat in the background for days). Enough for anything measured in days, like Overdue. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const timer = setInterval(tick, MINUTE_MS)
    const onShow = () => document.visibilityState === 'visible' && tick()
    document.addEventListener('visibilitychange', onShow)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onShow)
    }
  }, [])
  return now
}
