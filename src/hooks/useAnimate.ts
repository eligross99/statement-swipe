import { useCallback, useEffect, useRef } from 'react'
import { canAnimate, DURATION, EASE_TRAVEL, reducedMotion } from '../lib/motion'

interface Options {
  duration?: number
  easing?: string
  /** Hold the last frame after finishing (for exits, until the element is removed). */
  hold?: boolean
}

/**
 * Returns `animate(el, keyframes, options, reduced?)`, which plays a Web Animation and resolves
 * when it finishes. With Reduce Motion on, it plays the `reduced` keyframes as a quick fade
 * instead (or skips the animation if none are given). Where animation isn't supported it
 * resolves right away.
 *
 * Animations still running when the component unmounts are cancelled, and their promises never
 * resolve, so follow-up code (like "now resolve the card") can't run after the screen is gone.
 */
export function useAnimate() {
  const running = useRef(new Set<Animation>())

  useEffect(() => {
    const set = running.current
    return () => set.forEach((a) => a.cancel())
  }, [])

  return useCallback(
    (el: Element | null, keyframes: Keyframe[], options: Options = {}, reduced?: Keyframe[]): Promise<void> => {
      if (!el || !canAnimate()) return Promise.resolve()
      const reduce = reducedMotion()
      if (reduce && !reduced) return Promise.resolve()
      const anim = el.animate(reduce ? reduced! : keyframes, {
        duration: reduce ? DURATION.fade : (options.duration ?? DURATION.exit),
        easing: reduce ? 'ease-out' : (options.easing ?? EASE_TRAVEL),
        fill: options.hold ? 'forwards' : 'none',
      })
      running.current.add(anim)
      return new Promise((resolve) => {
        anim.finished.then(
          () => {
            running.current.delete(anim)
            resolve()
          },
          // Cancelled: stay pending on purpose.
          () => running.current.delete(anim),
        )
      })
    },
    [],
  )
}
