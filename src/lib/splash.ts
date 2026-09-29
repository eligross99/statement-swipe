// The launch screen: the app's logo, drawn by index.html from the very first paint, before any of
// the app's code has loaded. Like other polished apps, it shows only the logo, only for as long as
// loading takes (never an added wait), then fades away to reveal the first screen.

import { canAnimate, DURATION, EASE_OUT, reducedMotion } from './motion'

/** How long the launch screen takes to fade away. */
export const SPLASH_FADE = 450

/** Fades the launch screen away, then removes it. Safe to call more than once. */
export function hideSplash(): void {
  const splash = document.getElementById('splash')
  if (!splash || splash.dataset.leaving) return
  splash.dataset.leaving = 'true'
  if (!canAnimate()) {
    splash.remove()
    return
  }
  const reduce = reducedMotion()
  const options = { duration: reduce ? DURATION.fade : SPLASH_FADE, easing: EASE_OUT, fill: 'forwards' as const }
  const fade = splash.animate([{ opacity: 1 }, { opacity: 0 }], options)
  // The logo grows a touch as it fades, as if the app were opening out of it. Reduce Motion: fade only.
  const logo = splash.firstElementChild
  if (logo && !reduce) logo.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }], options)
  const remove = () => splash.remove()
  fade.finished.then(remove, remove)
}
