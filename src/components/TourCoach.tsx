import { ChevronLeft } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import { canAnimate, token } from '../lib/motion'
import { ALL_LINES, target, TOUR_LENGTH, type TourLine, type TourTarget } from '../lib/tour'
import './TourCoach.css'

interface Props {
  line: TourLine
  /** 1 to TOUR_LENGTH. */
  step: number
  /** How far through the step (0 to 1): fills the step's bar part way. */
  progress: number
  /** After the tour, on the real Import screen: nothing is locked, and Skip becomes Done. */
  outro?: boolean
  /** Back to the previous step (missing on the first step). */
  onBack?: () => void
  /** Skip tour, or Done after it. */
  onClose: () => void
}

/** What the card says for a moment when someone tries to skip ahead by swiping it left. */
const FINISH_FIRST = 'To move on, finish this step first. The tour goes one step at a time.'

/** Pulling past this (px) goes back a step, or says to finish the step first. */
const PULL_BACK = 70
const PULL_AHEAD = 44

/** Rubber-band resistance: the card follows the finger less and less, never past `max` px. */
function stretch(d: number, max: number): number {
  return Math.sign(d) * max * (1 - Math.exp(-Math.abs(d) / (max * 2)))
}

/**
 * The tour's instructions: a dark green card pinned to the top of the screen, above every screen,
 * sheet, and page. It keeps one height for every instruction and reserves it (`--coach-space`), and
 * the app moves down to make room, so it never covers a button and the screen never shifts.
 *
 * While the tour runs it also keeps the user on the path: only the instruction's controls respond
 * (`line.allow`); tapping anything else lights the card up and shows the tap guide again. The card
 * itself can be swiped right to go back a step; pulled any other way it stretches and springs back.
 */
export function TourCoach({ line, step, progress, outro = false, onBack, onClose }: Props) {
  const outer = useRef<HTMLElement>(null)
  const card = useRef<HTMLDivElement>(null)
  // Bumped to replay the tap guide from the start (a tap on the card, or a blocked tap elsewhere).
  const [replay, setReplay] = useState(0)
  // After a swipe ahead, the instruction it happened on: its text says to finish the step first, for a
  // moment (and never carries over to the next instruction).
  const [finishFirst, setFinishFirst] = useState<string | null>(null)
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const drag = useRef<{ x: number; y: number; axis: 'x' | 'y' | null } | null>(null)

  // Keep --coach-space equal to the card's height, including when the text size changes.
  useLayoutEffect(() => {
    const el = outer.current
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

  useEffect(() => () => void (finishTimer.current && clearTimeout(finishTimer.current)), [])

  /** Lights the card up in mint for a moment (color, not movement, so it plays with Reduce Motion too). */
  const flash = () => {
    const el = card.current
    if (!el || !canAnimate()) return
    const [pill, edge, float] = ['--dock-pill', '--dock-edge', '--shadow-float'].map(token)
    const lit = { boxShadow: `inset 0 1px 0 ${edge}, 0 0 0 3px ${pill}, ${float}` }
    const off = { boxShadow: `inset 0 1px 0 ${edge}, 0 0 0 0 transparent, ${float}` }
    el.animate([lit, { ...lit, offset: 0.5 }, off], { duration: 1200, easing: 'ease-out' })
  }

  /** Points the user back at the step: the card lights up and the tap guide plays again. */
  const nudge = () => {
    flash()
    setReplay((n) => n + 1)
  }

  // Only the instruction's controls respond while the tour runs. Checked before anything else sees
  // the event (the capture phase), so a blocked tap never reaches the app.
  const allowKey = line.allow.join()
  useEffect(() => {
    if (outro) return
    const allowed = allowKey ? allowKey.split(',').map((t) => target(t as TourTarget)).join(',') : ''
    const ok = (el: EventTarget | null) =>
      el instanceof Element && (!!el.closest('.coach') || (!!allowed && !!el.closest(allowed)))
    const block = (e: Event) => {
      if (ok(e.target)) return
      e.preventDefault()
      e.stopPropagation()
      if (e.type === 'pointerdown' || e.type === 'keydown') nudge()
    }
    const onKey = (e: KeyboardEvent) => {
      // Escape would close a page or sheet the step needs; Enter and Space act like taps.
      if (e.key === 'Escape' || ((e.key === 'Enter' || e.key === ' ') && !ok(e.target))) block(e)
    }
    const opts = { capture: true }
    document.addEventListener('pointerdown', block, opts)
    document.addEventListener('click', block, opts)
    document.addEventListener('keydown', onKey, opts)
    return () => {
      document.removeEventListener('pointerdown', block, opts)
      document.removeEventListener('click', block, opts)
      document.removeEventListener('keydown', onKey, opts)
    }
  }, [allowKey, outro])

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    // The card's own buttons (back, Skip) work as buttons.
    if ((e.target as Element).closest('button')) return
    drag.current = { x: e.clientX, y: e.clientY, axis: null }
    card.current?.classList.add('is-pressed')
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Still works without capture.
    }
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    const el = card.current
    if (!d || !el) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.axis) {
      if (Math.hypot(dx, dy) < 8) return
      d.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      el.classList.remove('is-pressed')
      el.classList.add('is-dragging')
    }
    if (d.axis === 'x') {
      // Right goes back, so it follows the finger further; left only stretches.
      const x = dx > 0 && onBack ? stretch(dx, 90) : stretch(dx, 22)
      el.style.transform = `translateX(${x}px)`
    } else if (dy > 0) {
      // Pulled down, it stretches a little, as if held at the top.
      const y = stretch(dy, 22)
      el.style.transform = `translateY(${y}px) scaleY(${1 + y / 300})`
    } else {
      el.style.transform = `translateY(${stretch(dy, 14)}px)`
    }
  }

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    const el = card.current
    drag.current = null
    if (!d || !el) return
    el.classList.remove('is-pressed', 'is-dragging')
    el.style.transform = ''
    const dx = e.clientX - d.x
    if (!d.axis) {
      // A tap: the card presses in (above) and shows where to tap again.
      setReplay((n) => n + 1)
    } else if (d.axis === 'x' && dx > PULL_BACK && onBack) {
      onBack()
    } else if (d.axis === 'x' && dx < -PULL_AHEAD && !outro) {
      nudge()
      setFinishFirst(line.title)
      if (finishTimer.current) clearTimeout(finishTimer.current)
      finishTimer.current = setTimeout(() => setFinishFirst(null), 2600)
    }
  }

  const onPointerCancel = () => {
    drag.current = null
    card.current?.classList.remove('is-pressed', 'is-dragging')
    if (card.current) card.current.style.transform = ''
  }

  const text = finishFirst === line.title ? FINISH_FIRST : line.text

  return (
    <>
      <aside ref={outer} className="coach" aria-label="Tour">
        <div
          ref={card}
          className="coach-card"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        >
          <div className="coach-top">
            {/* Faded on the first step, like Undo with nothing to undo, so the row never shifts. */}
            <button
              type="button"
              className="coach-back"
              onClick={onBack}
              disabled={!onBack}
              aria-label="Back a step"
              // After the tour there's nothing to go back to; its space stays so nothing shifts.
              style={outro ? { visibility: 'hidden' } : undefined}
            >
              <ChevronLeft size={20} aria-hidden />
            </button>
            <p className="coach-count">{outro ? 'Tour complete' : `Step ${step} of ${TOUR_LENGTH}`}</p>
            <span className="coach-bars" aria-hidden>
              {Array.from({ length: TOUR_LENGTH }, (_, i) => {
                const fill = outro || i + 1 < step ? 1 : i + 1 === step ? 0.25 + 0.75 * progress : 0
                return (
                  <span key={i} className="coach-bar">
                    <span className="coach-bar-fill" style={{ transform: `scaleX(${fill})` }} />
                  </span>
                )
              })}
            </span>
            <button type="button" className="coach-skip" onClick={onClose}>
              {outro ? 'Done' : 'Skip tour'}
            </button>
          </div>

          {/* Every line the card can show sits in the same spot, invisibly, so the card is always as
              tall as its longest line and never changes height between steps. */}
          <div className="coach-lines">
            {[...ALL_LINES, { title: line.title, text: FINISH_FIRST }].map((l, i) => (
              <div key={i} className="coach-body coach-body--sizer" aria-hidden>
                <p className="coach-title">{l.title}</p>
                <p className="coach-text">{l.text}</p>
              </div>
            ))}
            {/* The live region (role status) stays put so screen readers announce each new instruction; the words
                inside are keyed, so they fade in fresh when they change. */}
            <div className="coach-live" role="status">
              <div key={line.title + text} className="coach-body enter-fade">
                <p className="coach-title">{line.title}</p>
                <p className="coach-text">{text}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
      <TourPointer key={replay} targets={line.point} />
    </>
  )
}

/** The first of `targets` that's on screen and not covered, and whether it's cut off by the screen's edge. */
function findTarget(targets: TourTarget[]): { el: HTMLElement; visible: boolean; cutOff: boolean } | null {
  for (const t of targets) {
    for (const el of document.querySelectorAll<HTMLElement>(target(t))) {
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) continue
      const cutOff = r.top < 0 || r.bottom > window.innerHeight
      const y = Math.min(Math.max(r.top + r.height / 2, 0), window.innerHeight - 1)
      const hit = document.elementFromPoint(r.left + r.width / 2, y)
      if (hit && el.contains(hit)) return { el, visible: true, cutOff }
      if (cutOff) return { el, visible: false, cutOff }
    }
  }
  return null
}

/** The target's rounded corners, or its container's when the target itself is square (a row's button). */
function cornerRadius(el: HTMLElement): string {
  const own = getComputedStyle(el).borderRadius
  return own !== '0px' || !el.parentElement ? own : getComputedStyle(el.parentElement).borderRadius
}

/** Scrolls the nearest scrolling box so `el` sits in its middle (up and down only). */
function scrollToMiddle(el: HTMLElement) {
  let box = el.parentElement
  while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement
  if (!box) return
  const offset = el.getBoundingClientRect().top - box.getBoundingClientRect().top
  box.scrollTo({ top: box.scrollTop + offset - (box.clientHeight - el.offsetHeight) / 2, behavior: 'smooth' })
}

/**
 * The tap guide: a soft glow around the control to tap, and a touch dot pressing it, repeating
 * gently. It follows the control as things move, hides while something covers it, and scrolls a
 * hidden control into view. Remounted (by its key) to start over.
 */
function TourPointer({ targets }: { targets: TourTarget[] }) {
  const ring = useRef<HTMLDivElement>(null)
  const key = targets.join()
  useEffect(() => {
    if (!key) return
    const names = key.split(',') as TourTarget[]
    let frame = 0
    let revealed: HTMLElement | null = null
    const tick = () => {
      frame = requestAnimationFrame(tick)
      const r = ring.current
      if (!r) return
      const found = findTarget(names)
      // Scrolls each control into full view once (not again, if it can't go any further).
      if (found?.cutOff && revealed !== found.el) {
        revealed = found.el
        scrollToMiddle(found.el)
      }
      if (!found?.visible) {
        delete r.dataset.on
        return
      }
      const b = found.el.getBoundingClientRect()
      r.style.transform = `translate(${b.left}px, ${b.top}px)`
      r.style.width = `${b.width}px`
      r.style.height = `${b.height}px`
      r.style.borderRadius = cornerRadius(found.el)
      r.dataset.on = ''
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [key])

  if (!key) return null
  return (
    <div ref={ring} className="tour-ring" aria-hidden>
      <span className="tour-tap" />
    </div>
  )
}
