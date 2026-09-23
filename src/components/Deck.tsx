import { Check, Layers, Search } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { formatDate } from '../lib/dates'
import { usd } from '../lib/format'
import { reviewedCount, sumAmounts } from '../lib/review'
import type { Transaction } from '../types'
import './Deck.css'

export interface Offset {
  x: number
  y: number
}

/** A card that was just resolved, animating off the deck. */
export interface LeavingCard {
  txn: Transaction
  dir: 'left' | 'right' | 'up'
  from: Offset
}

interface Props {
  txns: Transaction[]
  index: number
  /** True while an overlay is open, so arrow keys don't act on the hidden deck. */
  paused: boolean
  leaving: LeavingCard | null
  onLeaveDone: () => void
  onApprove: (from: Offset) => void
  onInvestigate: () => void
  onFile: () => void
}

/** How far (px) a drag must travel before release counts as a swipe. */
const SWIPE_THRESHOLD = 92
/** Drag distance (px) at which a stamp is fully visible. */
const STAMP_FULL = 120
const CENTER: Offset = { x: 0, y: 0 }

export function Deck({ txns, index, paused, leaving, onLeaveDone, onApprove, onInvestigate, onFile }: Props) {
  const [drag, setDrag] = useState<Offset>(CENTER)
  const [dragging, setDragging] = useState(false)
  // The pointer position where the drag started; a ref because it doesn't affect rendering.
  const start = useRef<Offset | null>(null)

  const top = txns[index] ?? null
  const reviewed = reviewedCount(txns)

  // Arrow-key shortcuts for the three actions.
  useEffect(() => {
    if (paused || !top) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') onApprove(CENTER)
      else if (e.key === 'ArrowLeft') onInvestigate()
      else if (e.key === 'ArrowUp') onFile()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paused, top, onApprove, onInvestigate, onFile])

  const snapBack = () => {
    start.current = null
    setDragging(false)
    setDrag(CENTER)
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    start.current = { x: e.clientX, y: e.clientY }
    setDragging(true)
    try {
      // Keep receiving moves even if the finger leaves the card.
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Not supported or pointer already gone; the drag still works without capture.
    }
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return
    setDrag({ x: e.clientX - start.current.x, y: e.clientY - start.current.y })
  }

  const onPointerUp = () => {
    if (!start.current) return
    const { x, y } = drag
    snapBack()
    if (y < -SWIPE_THRESHOLD && Math.abs(y) > Math.abs(x)) onFile()
    else if (x > SWIPE_THRESHOLD) onApprove({ x, y })
    else if (x < -SWIPE_THRESHOLD) onInvestigate()
  }

  // Stamp opacity: fades in with drag distance in the dominant direction.
  const vertical = drag.y < 0 && Math.abs(drag.y) > Math.abs(drag.x)
  const approveOp = !vertical && drag.x > 8 ? Math.min(drag.x / STAMP_FULL, 1) : 0
  const lookOp = !vertical && drag.x < -8 ? Math.min(-drag.x / STAMP_FULL, 1) : 0
  const fileOp = vertical ? Math.min(-drag.y / STAMP_FULL, 1) : 0

  // The top card plus up to two peeking behind it. Rendered back-to-front, keyed by id, so a
  // peeking card keeps its DOM node when promoted and its CSS transition slides it into place.
  const stack = [2, 1, 0].flatMap((off) => {
    const t = txns[index + off]
    return t ? [{ t, off }] : []
  })

  return (
    <div className="deck">
      <section className="deck-progress" aria-label="Review progress">
        <div className="deck-progress-row num">
          <span>
            {reviewed} of {txns.length}
          </span>
          <span>${usd(sumAmounts(txns))}</span>
        </div>
        <div className="deck-progress-track">
          <div className="deck-progress-fill" style={{ width: `${txns.length ? (reviewed / txns.length) * 100 : 0}%` }} />
        </div>
      </section>

      <div className="deck-stack">
        {stack.map(({ t, off }) =>
          off === 0 ? (
            <div
              key={t.id}
              className={`deck-card deck-card--top${dragging ? ' is-dragging' : ''}`}
              style={{ transform: `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 18}deg)` }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={snapBack}
              role="group"
              aria-label={`Purchase: ${t.desc}, $${usd(t.amount)}`}
            >
              <Stamp opacity={approveOp} kind="approve" label="RECOGNIZED" />
              <Stamp opacity={lookOp} kind="investigate" label="LOOK CLOSER" />
              <Stamp opacity={fileOp} kind="pile" label="PILE" />
              <CardFace txn={t} />
            </div>
          ) : (
            <div
              key={t.id}
              className="deck-card"
              style={{ transform: `translateY(${off * 10}px) scale(${1 - off * 0.04})` }}
              aria-hidden
            >
              <CardFace txn={t} />
            </div>
          ),
        )}
        {leaving && <FlyingCard key={`leaving-${leaving.txn.id}`} card={leaving} onDone={onLeaveDone} />}
      </div>

      <div className="deck-actions">
        <ActionButton kind="investigate" label="Look closer" keys="ArrowLeft" onClick={onInvestigate} disabled={!top}>
          <Search size={22} />
        </ActionButton>
        <ActionButton kind="pile" label="File it" keys="ArrowUp" onClick={onFile} disabled={!top} big>
          <Layers size={26} />
        </ActionButton>
        <ActionButton kind="approve" label="Approve" keys="ArrowRight" onClick={() => onApprove(CENTER)} disabled={!top}>
          <Check size={24} strokeWidth={2.5} />
        </ActionButton>
      </div>
    </div>
  )
}

function CardFace({ txn }: { txn: Transaction }) {
  return (
    <div className="card-face">
      <div className="card-face-top">
        <span className="card-face-cat">{txn.cat}</span>
        <span className="card-face-date num">{formatDate(txn.date)}</span>
      </div>
      <div className="card-face-body">
        <p className="card-face-amount num">${usd(txn.amount)}</p>
        <p className="card-face-desc">{txn.desc}</p>
        {txn.loc && <p className="card-face-loc">{txn.loc}</p>}
      </div>
      <p className="card-face-hint">Swipe right to approve · up to file · left to look closer</p>
    </div>
  )
}

function Stamp({ opacity, kind, label }: { opacity: number; kind: 'approve' | 'investigate' | 'pile'; label: string }) {
  return (
    <div className={`stamp stamp--${kind}`} style={{ opacity }} aria-hidden>
      {label}
    </div>
  )
}

/** Animates a copy of a resolved card off-screen, then reports back so it can be removed. */
function FlyingCard({ card, onDone }: { card: LeavingCard; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  // Keep the latest callback without restarting the animation when the parent re-renders.
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })

  useEffect(() => {
    const el = ref.current
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    // No Web Animations support (e.g. the test environment) or reduced motion: skip the flourish.
    if (!el || typeof el.animate !== 'function' || reduceMotion) {
      done.current()
      return
    }
    const { x, y } = card.from
    const from = `translate(${x}px, ${y}px) rotate(${x / 18}deg)`
    const to =
      card.dir === 'right'
        ? `translate(${x + 640}px, ${y + 60}px) rotate(28deg)`
        : card.dir === 'left'
          ? `translate(${x - 640}px, ${y + 60}px) rotate(-28deg)`
          : `translate(${x}px, ${y - 900}px)`
    const anim = el.animate(
      [
        { transform: from, opacity: 1 },
        { transform: to, opacity: 0 },
      ],
      { duration: 260, easing: 'ease-in', fill: 'forwards' },
    )
    anim.onfinish = () => done.current()
    return () => {
      anim.onfinish = null
      anim.cancel()
    }
  }, [card])

  return (
    <div ref={ref} className="deck-card deck-card--leaving" aria-hidden>
      <CardFace txn={card.txn} />
    </div>
  )
}

function ActionButton(props: {
  kind: 'approve' | 'investigate' | 'pile'
  label: string
  keys: string
  onClick: () => void
  disabled: boolean
  big?: boolean
  children: ReactNode
}) {
  return (
    <div className="action-btn-wrap">
      <button
        type="button"
        className={`action-btn action-btn--${props.kind}${props.big ? ' action-btn--big' : ''}`}
        onClick={props.onClick}
        disabled={props.disabled}
        aria-label={props.label}
        aria-keyshortcuts={props.keys}
      >
        {props.children}
      </button>
      <span className="action-btn-label" aria-hidden>
        {props.label}
      </span>
    </div>
  )
}
