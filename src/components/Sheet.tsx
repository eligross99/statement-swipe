import { X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useAnimate } from '../hooks/useAnimate'
import { useEscape } from '../hooks/useEscape'

/** Slides the sheet away, then runs `after` (or the sheet's `onDismiss` when none is given). */
export type CloseSheet = (after?: () => void) => void

interface Props {
  id: string
  title: string
  /** Called after the sheet is dismissed without a choice (close button, tap outside, Escape). */
  onDismiss: () => void
  /** False while another sheet is open on top of this one: Escape and outside taps then belong to that one. */
  dismissible?: boolean
  children: (close: CloseSheet) => ReactNode
}

/**
 * A bottom sheet that rises in, and slides back down before anything else happens, so the user
 * sees where it went. Children get `close(after)` to finish with a choice.
 */
export function Sheet({ id, title, onDismiss, dismissible = true, children }: Props) {
  const animate = useAnimate()
  // Elements are kept in state (via callback refs) so `close` can be handed to children while rendering.
  const [scrim, setScrim] = useState<HTMLDivElement | null>(null)
  const [panel, setPanel] = useState<HTMLDivElement | null>(null)
  const [closing, setClosing] = useState(false)

  const close: CloseSheet = (after = onDismiss) => {
    // Ignore further taps while sliding away: the choice has been made.
    if (closing) return
    setClosing(true)
    const bg = scrim ? getComputedStyle(scrim).backgroundColor : ''
    void Promise.all([
      animate(panel, [{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }], { hold: true }, [
        { opacity: 1 },
        { opacity: 0 },
      ]),
      animate(scrim, [{ backgroundColor: bg }, { backgroundColor: 'transparent' }], { hold: true }, [
        { backgroundColor: bg },
        { backgroundColor: 'transparent' },
      ]),
    ]).then(after)
  }
  useEscape(() => dismissible && close())

  return (
    <div ref={setScrim} className="sheet-scrim" onClick={() => dismissible && close()}>
      <div
        ref={setPanel}
        className="sheet motion-fade"
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <h2 id={id} className="sheet-title">
            {title}
          </h2>
          <button type="button" className="icon-btn icon-btn--flat" onClick={() => close()} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {children(close)}
      </div>
    </div>
  )
}
