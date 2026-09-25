// A short vibration when a swipe lands. Android browsers can vibrate; iPhone browsers don't let
// websites vibrate at all (that comes with an App Store version), so there it quietly does nothing.

/** How long the swipe "tick" lasts (ms): short enough to feel like a click, not a buzz. */
export const SWIPE_TICK_MS = 12

/**
 * Whether this is a touch phone whose browser can vibrate, so Settings only offers the switch where it
 * does something. Desktop Chrome has `vibrate` too, but no motor to run it.
 */
export function canVibrate(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function' &&
    (window.matchMedia?.('(pointer: coarse)').matches ?? false)
  )
}

/** Vibrates briefly if this browser can. */
export function tick(ms: number = SWIPE_TICK_MS): void {
  if (!canVibrate()) return
  try {
    navigator.vibrate(ms)
  } catch {
    // Some browsers throw instead of ignoring the call (e.g. before the user has touched the page).
  }
}
