import { useLayoutEffect, useRef } from 'react'
import { TOUR_LENGTH, type Coach } from '../lib/tour'
import './TourCoach.css'

interface Props {
  coach: Coach
  onSkip: () => void
  onNext: (go: 'tasks' | 'finish') => void
}

/**
 * The tour's instructions: a dark green card pinned to the top of the screen, above every screen,
 * sheet, and page, so it's never hidden. It reserves its own height (`--coach-space` on the page),
 * and the app moves down to make room, so it never covers a button either (see TourCoach.css).
 */
export function TourCoach({ coach, onSkip, onNext }: Props) {
  const ref = useRef<HTMLElement>(null)

  // Keep --coach-space equal to the card's height, including when its words change length.
  useLayoutEffect(() => {
    const el = ref.current
    const root = document.documentElement
    if (!el) return
    const update = () => root.style.setProperty('--coach-space', `${el.offsetHeight}px`)
    update()
    root.dataset.coach = ''
    const watcher = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    watcher?.observe(el)
    return () => {
      watcher?.disconnect()
      delete root.dataset.coach
      root.style.removeProperty('--coach-space')
    }
  }, [])

  return (
    <aside ref={ref} className="coach" aria-label="Tour">
      <div className="coach-card">
        <div className="coach-top">
          <p className="coach-count">
            Step {coach.number} of {TOUR_LENGTH}
          </p>
          <span className="coach-bars" aria-hidden>
            {Array.from({ length: TOUR_LENGTH }, (_, i) => (
              <span key={i} className={`coach-bar${i < coach.number ? ' is-done' : ''}`} />
            ))}
          </span>
          <button type="button" className="coach-skip" onClick={onSkip}>
            Skip tour
          </button>
        </div>
        {/* The live region stays put so screen readers announce each new instruction; the words
            inside are keyed, so they fade in fresh when they change. */}
        <div aria-live="polite">
          <div key={coach.title} className="coach-body enter-fade">
            <p className="coach-title">{coach.title}</p>
            <p className="coach-text">{coach.text}</p>
            {coach.next && (
              <button type="button" className="coach-next" onClick={() => onNext(coach.next!.go)}>
                {coach.next.label}
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}
