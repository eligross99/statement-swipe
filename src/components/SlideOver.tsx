import { ChevronLeft } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useAnimate } from '../hooks/useAnimate'
import { useEscape } from '../hooks/useEscape'
import './SlideOver.css'

/** Slides the page away to the right, then runs `after` (or the page's `onBack` when none is given). */
export type LeavePage = (after?: () => void) => void

interface Props {
  /** The page's name for screen readers: the id of its heading, or a label. */
  labelledBy?: string
  label?: string
  backLabel: string
  onBack: () => void
  /** False while something on the page (a sheet, a note being edited) should get Escape instead. */
  escapable?: boolean
  children: (leave: LeavePage) => ReactNode
}

/**
 * A full-screen page that slides in from the right over the current screen, like opening a page in
 * an iPhone app, and slides back out before anything else happens. The screen underneath stays put,
 * scroll position and all. The back button stays pinned at the top while the page scrolls.
 * Used for Look closer and for a folder opened from Tasks.
 */
export function SlideOver({ labelledBy, label, backLabel, onBack, escapable = true, children }: Props) {
  const animate = useAnimate()
  // Kept in state (via a callback ref), like Sheet, so `leave` can be handed to children while rendering.
  const [page, setPage] = useState<HTMLDivElement | null>(null)
  const [leaving, setLeaving] = useState(false)

  const leave: LeavePage = (after = onBack) => {
    // Ignore further taps while sliding away.
    if (leaving) return
    setLeaving(true)
    void animate(page, [{ transform: 'translateX(0)' }, { transform: 'translateX(100%)' }], { hold: true }, [
      { opacity: 1 },
      { opacity: 0 },
    ]).then(after)
  }
  useEscape(() => escapable && leave())

  return (
    <div
      ref={setPage}
      className="overlay motion-fade"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-label={label}
    >
      <div className="overlay-inner">
        {/* Same round back button, in the same spot, as the header on other screens. */}
        <div className="slide-over-top">
          <button type="button" className="icon-btn" onClick={() => leave()} aria-label={backLabel} autoFocus>
            <ChevronLeft size={22} />
          </button>
        </div>
        {children(leave)}
      </div>
    </div>
  )
}
