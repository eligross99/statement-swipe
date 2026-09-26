import { useEffect, useSyncExternalStore } from 'react'
import { applyTheme, resolveTheme, SYSTEM_DARK, type ThemeChoice } from '../lib/theme'

const subscribe = (onChange: () => void) => {
  const query = window.matchMedia?.(SYSTEM_DARK)
  query?.addEventListener('change', onChange)
  return () => query?.removeEventListener('change', onChange)
}
const systemDark = () => window.matchMedia?.(SYSTEM_DARK).matches ?? false

/**
 * Shows the chosen theme, following the phone live (e.g. when it switches to dark at sunset) while
 * the choice is System. Waits for saved settings (`ready`): until then `public/theme.js` has already
 * applied the saved choice, and the default ("System") could briefly undo it.
 */
export function useTheme(choice: ThemeChoice, ready: boolean) {
  const dark = useSyncExternalStore(subscribe, systemDark)
  useEffect(() => {
    if (ready) applyTheme(choice, resolveTheme(choice, dark))
  }, [choice, dark, ready])
}
