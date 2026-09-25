import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { canAnimate, DURATION, EASE_OUT, reducedMotion } from '../lib/motion'

/**
 * A list that shows its first `limit` items, with "Show all" / "Show fewer". The list grows and
 * shrinks smoothly instead of jumping. Put `listRef` on the element whose children are the rows,
 * and `toggleRef` on the button. `endPad` is any space below the last row (e.g. a border).
 * Rows past `limit` should fade in (`.enter-fade`) when shown.
 */
export function useShowMore<T, E extends HTMLElement>(items: T[], limit: number, endPad = 0) {
  const [all, setAll] = useState(false)
  const listRef = useRef<E>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  // True while the list is shrinking, so a second tap can't start another change mid-way.
  const moving = useRef(false)
  const smooth = () => canAnimate() && !reducedMotion()

  /** The list grows smoothly to its full height while the new rows fade in. */
  const showAll = () => {
    const el = listRef.current
    if (!el || !smooth()) return setAll(true)
    const from = el.offsetHeight
    flushSync(() => setAll(true))
    el.animate([{ height: `${from}px` }, { height: `${el.offsetHeight}px` }], {
      duration: DURATION.reveal,
      easing: EASE_OUT,
    })
  }

  /** The extra rows fade out while the list shrinks smoothly back to the first few. */
  const showFewer = async () => {
    const el = listRef.current
    const rows = el ? ([...el.children] as HTMLElement[]) : []
    if (el && smooth() && rows[limit] && !moving.current) {
      moving.current = true
      // Height of the first rows: from the list's top edge to the first extra row, plus any end space.
      const to = rows[limit].getBoundingClientRect().top - el.getBoundingClientRect().top + endPad
      for (const row of rows.slice(limit)) {
        row.animate([{ opacity: 1 }, { opacity: 0 }], { duration: DURATION.reveal * 0.6, fill: 'forwards' })
      }
      const shrink = el.animate([{ height: `${el.offsetHeight}px` }, { height: `${to}px` }], {
        duration: DURATION.reveal,
        easing: EASE_OUT,
        fill: 'forwards',
      })
      await shrink.finished.catch(() => undefined)
      flushSync(() => setAll(false))
      shrink.cancel() // the list is now this height on its own
      moving.current = false
    } else if (!moving.current) {
      setAll(false)
    }
    // The page just got shorter, so bring the button back into view instead of leaving the user
    // looking at empty space below it.
    requestAnimationFrame(() =>
      toggleRef.current?.scrollIntoView({ block: 'nearest', behavior: smooth() ? 'smooth' : 'auto' }),
    )
  }

  return {
    shown: all ? items : items.slice(0, limit),
    all,
    /** Whether there's anything to show or hide (more items than the limit). */
    hasMore: items.length > limit,
    listRef,
    toggleRef,
    toggle: all ? () => void showFewer() : showAll,
  }
}
