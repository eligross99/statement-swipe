// Shared motion rules, so everything in the app moves the same way.
// Principle: react instantly, then let the result be seen (eased, roughly 250–400ms).

import type { Screen } from '../types'

/** Decelerating curve for short entrances: starts quick, settles gently. Same as `--ease-out`. */
export const EASE_OUT = 'cubic-bezier(0.22, 0.8, 0.36, 1)'
/** A softer decelerating curve for things that travel off screen (flying cards, sheets and views
 *  sliding away). Spreads the movement out so the eye can follow where things went. */
export const EASE_TRAVEL = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
/** A card flying off the deck: a gentle start, so it doesn't vanish the moment the finger lifts. */
export const EASE_FLY = 'cubic-bezier(0.35, 0.2, 0.3, 1)'

export const DURATION = {
  /** A card flying off the deck. */
  fly: 600,
  /** A card flying back in on undo. */
  flyBack: 400,
  /** A full-screen view or sheet sliding away. */
  exit: 280,
  /** Quick fade used instead of movement when Reduce Motion is on. */
  fade: 150,
  /** After Look closer closes: how long the card stays put before it flies, so the user sees it. */
  pause: 150,
} as const

/** How a screen appears. The matching CSS classes (`.enter-push` etc.) live in `index.css`. */
export type Enter = 'none' | 'fade' | 'push' | 'pop' | 'rise'

/** Picks a screen's entrance from where the user came from: forward slides in from the right,
 *  back from the left, finishing the review rises up. */
export function screenEnter(from: Screen, to: Screen): Enter {
  if (from === to) return 'none'
  if (to === 'import') return 'push'
  if (from === 'import') return 'rise'
  if (from === 'deck' && to === 'summary') return 'rise'
  if (from === 'summary' && to === 'pile') return 'push'
  if (from === 'pile' && to === 'summary') return 'pop'
  return 'fade'
}

/** True when the user has turned on Reduce Motion in their phone or computer settings. */
export function reducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/** False where the Web Animations API is missing (e.g. the test environment): skip all motion. */
export function canAnimate(): boolean {
  return typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function'
}

/** Waits `ms`, or not at all when there's no animation to wait for. */
export function pause(ms: number): Promise<void> {
  if (!canAnimate() || reducedMotion()) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Resolves a CSS color token (e.g. `--brand-tint`) so it can be used in a Web Animation. */
export function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}
