import { Check, Layers, Search } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { useAnimate } from '../hooks/useAnimate'
import { formatDate } from '../lib/dates'
import { hasCategory, usd } from '../lib/format'
import { tick } from '../lib/haptics'
import { canAnimate, DURATION, EASE_FLY, EASE_OUT, reducedMotion } from '../lib/motion'
import { reviewedCount, sumAmounts } from '../lib/review'
import type { Transaction } from '../types'
import './Deck.css'

export interface Offset {
  x: number
  y: number
}

export type Direction = 'left' | 'right' | 'up'

/** A card that was just resolved, animating off the deck. */
export interface LeavingCard {
  txn: Transaction
  dir: Direction
  from: Offset
}

/** A card brought back by undo, flying in from the side it left. */
export interface ReturningCard {
  txnId: string
  dir: Direction
}

interface Props {
  txns: Transaction[]
  index: number
  /** True while an overlay is open or a card is on its way out: the deck ignores input. */
  paused: boolean
  /** Where the top card rests while its action is in progress (leaning toward Look closer or File). */
  lean: Offset | null
  leaving: LeavingCard | null
  returning: ReturningCard | null
  onLeaveDone: () => void
  onApprove: (from: Offset) => void
  onInvestigate: () => void
  onFile: () => void
  /** Vibrate briefly when a swipe lands (Android only; see lib/haptics). */
  haptics: boolean
  /** The tour: the only swipe (and button) that works, and the way the card leans to show it. */
  only?: Direction
}

/** How far (px) a drag must travel before release counts as a swipe. */
const SWIPE_THRESHOLD = 92
/** Drag distance (px) at which a stamp is fully visible. */
const STAMP_FULL = 120
const CENTER: Offset = { x: 0, y: 0 }

/** A card's transform at an offset: it tilts as it moves sideways, like a card held by its bottom. */
const cardTransform = ({ x, y }: Offset) => `translate(${x}px, ${y}px) rotate(${x / 18}deg)`

/** How far the card leans, and which stamp peeks, when the tour shows which way to swipe. */
const HINT: Record<Direction, { to: Offset; stamp: string }> = {
  right: { to: { x: 64, y: 0 }, stamp: '.stamp--approve' },
  left: { to: { x: -64, y: 0 }, stamp: '.stamp--investigate' },
  up: { to: { x: 0, y: -64 }, stamp: '.stamp--pile' },
}
/** One lean and settle, the wait before the first, and the rest between them (ms). */
const HINT_MS = 1700
const HINT_FIRST = 900
const HINT_REST = 2300

/** Where a card ends up when it flies off (or starts when it flies back in on undo). */
function offscreen(dir: Direction, from: Offset = CENTER): string {
  const { x, y } = from
  if (dir === 'up') return `translate(${x}px, ${y - 680}px)`
  const sign = dir === 'right' ? 1 : -1
  return `translate(${x + sign * 480}px, ${y + 40}px) rotate(${sign * 22}deg)`
}

export function Deck(props: Props) {
  const { txns, index, paused, lean, leaving, returning, onLeaveDone, onApprove, onInvestigate, onFile, haptics, only } =
    props
  /** False for the swipes the tour isn't teaching right now. */
  const allowed = (dir: Direction) => !only || only === dir
  const [drag, setDrag] = useState<Offset>(CENTER)
  const [dragging, setDragging] = useState(false)
  // The pointer position where the drag started; a ref because it doesn't affect rendering.
  const start = useRef<Offset | null>(null)
  const topRef = useRef<HTMLDivElement>(null)
  const animate = useAnimate()

  const top = txns[index] ?? null
  const reviewed = reviewedCount(txns)
  const topId = top?.id

  // Undo: the returning card flies back in from the side it left, so it's clear which one came back.
  useEffect(() => {
    if (!returning || returning.txnId !== topId) return
    void animate(
      topRef.current,
      [
        { transform: offscreen(returning.dir), opacity: 0 },
        { transform: cardTransform(CENTER), opacity: 1 },
      ],
      // Lands firmly: most of the travel happens early, then it settles into place.
      { duration: DURATION.flyBack, easing: EASE_OUT },
      [{ opacity: 0 }, { opacity: 1 }],
    )
  }, [returning, topId, animate])

  // Arrow-key shortcuts for the three actions.
  useEffect(() => {
    if (paused || !top) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        if (!only || only === 'right') onApprove(CENTER)
      } else if (e.key === 'ArrowLeft') {
        if (!only || only === 'left') onInvestigate()
      } else if (e.key === 'ArrowUp') {
        if (!only || only === 'up') onFile()
      } else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paused, top, only, onApprove, onInvestigate, onFile])

  // The tour's swipe hint: every few seconds the card leans the way to swipe, its stamp peeking
  // through and a touch dot showing where a finger would push, then settles back. It stops the
  // moment the card is touched. Skipped with Reduce Motion (the tour's words still say it).
  const hinting = !!only && !paused && !dragging && !leaving && !returning && !!topId
  useEffect(() => {
    const card = topRef.current
    if (!hinting || !only || !card || !canAnimate() || reducedMotion()) return
    const { to, stamp } = HINT[only]
    const rest = cardTransform(CENTER)
    const leanTo = cardTransform(to)
    const running: Animation[] = []
    const play = () => {
      const opts = { duration: HINT_MS }
      running.push(
        card.animate(
          [
            { offset: 0, transform: rest },
            { offset: 0.18, transform: rest, easing: 'cubic-bezier(0.45, 0, 0.25, 1)' },
            { offset: 0.5, transform: leanTo },
            { offset: 0.66, transform: leanTo, easing: EASE_OUT },
            { offset: 1, transform: rest },
          ],
          opts,
        ),
      )
      const stampEl = card.querySelector(stamp)
      if (stampEl)
        running.push(
          stampEl.animate(
            [
              { offset: 0, opacity: 0 },
              { offset: 0.2, opacity: 0 },
              { offset: 0.5, opacity: 0.75 },
              { offset: 0.66, opacity: 0.75 },
              { offset: 0.95, opacity: 0 },
            ],
            opts,
          ),
        )
      const dot = card.querySelector('.swipe-hint-touch')
      if (dot)
        running.push(
          dot.animate(
            [
              { offset: 0, opacity: 0, transform: 'translate(-50%, -50%) scale(1.4)' },
              { offset: 0.16, opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
              { offset: 0.6, opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
              { offset: 0.78, opacity: 0, transform: 'translate(-50%, -50%) scale(1)' },
            ],
            opts,
          ),
        )
      // Finished animations are dropped, so the list stays short.
      while (running.length > 3) running.shift()
    }
    let timer = setTimeout(function loop() {
      play()
      timer = setTimeout(loop, HINT_MS + HINT_REST)
    }, HINT_FIRST)
    return () => {
      clearTimeout(timer)
      running.forEach((a) => a.cancel())
    }
  }, [hinting, only, topId])

  const snapBack = () => {
    start.current = null
    setDragging(false)
    setDrag(CENTER)
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (paused || (e.pointerType === 'mouse' && e.button !== 0)) return
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
    const up = y < -SWIPE_THRESHOLD && Math.abs(y) > Math.abs(x)
    const dir: Direction | null = up ? 'up' : x > SWIPE_THRESHOLD ? 'right' : x < -SWIPE_THRESHOLD ? 'left' : null
    // A swipe the tour isn't teaching yet just springs back.
    if (!dir || !allowed(dir)) return
    if (haptics) tick()
    if (dir === 'up') onFile()
    else if (dir === 'right') onApprove({ x, y })
    else onInvestigate()
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
            {reviewed} of {txns.length} reviewed
          </span>
          <span>${usd(sumAmounts(txns))} total</span>
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
              ref={topRef}
              className={`deck-card deck-card--top${dragging ? ' is-dragging' : ''}`}
              style={{ transform: cardTransform(dragging ? drag : (lean ?? CENTER)) }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={snapBack}
              role="group"
              aria-label={`Purchase: ${t.desc}, $${usd(t.amount)}`}
            >
              <Stamp opacity={approveOp} kind="approve" label="APPROVE" />
              <Stamp opacity={lookOp} kind="investigate" label="LOOK CLOSER" />
              <Stamp opacity={fileOp} kind="pile" label="FILE" />
              {only && <span className="swipe-hint-touch" aria-hidden />}
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
        {/* While paused the buttons stay looking normal (no flicker) but do nothing. */}
        <ActionButton
          kind="investigate"
          label="Look closer"
          keys="ArrowLeft"
          onClick={() => !paused && onInvestigate()}
          disabled={!top || !allowed('left')}
        >
          <Search size={22} />
        </ActionButton>
        <ActionButton
          kind="pile"
          label="File"
          keys="ArrowUp"
          onClick={() => !paused && onFile()}
          disabled={!top || !allowed('up')}
          big
        >
          <Layers size={26} />
        </ActionButton>
        <ActionButton
          kind="approve"
          label="Approve"
          keys="ArrowRight"
          onClick={() => !paused && onApprove(CENTER)}
          disabled={!top || !allowed('right')}
        >
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
        {hasCategory(txn.cat) && <span className="card-face-cat">{txn.cat}</span>}
        <span className="card-face-date num">{formatDate(txn.date)}</span>
      </div>
      <div className="card-face-body">
        <p className="card-face-amount num">${usd(txn.amount)}</p>
        <p className="card-face-desc">{txn.desc}</p>
        {txn.loc && <p className="card-face-loc">{txn.loc}</p>}
      </div>
      {/* Lines only break between the three instructions, never inside one. */}
      <p className="card-face-hint">
        <span>Swipe right to approve,</span> <span>up to file,</span> <span>left to look closer</span>
      </p>
    </div>
  )
}

type StampKind = 'approve' | 'investigate' | 'pile' | 'flag'

function Stamp({ opacity, kind, label }: { opacity: number; kind: StampKind; label: string }) {
  return (
    <div className={`stamp stamp--${kind}`} style={{ opacity }} aria-hidden>
      {label}
    </div>
  )
}

/** The stamp a card shows as it flies off in each direction. Only flagging sends a card left. */
const FLY_STAMP: Record<Direction, { kind: StampKind; label: string }> = {
  right: { kind: 'approve', label: 'APPROVE' },
  up: { kind: 'pile', label: 'FILE' },
  left: { kind: 'flag', label: 'FLAG' },
}

/** Animates a copy of a resolved card off-screen, then reports back so it can be removed. */
function FlyingCard({ card, onDone }: { card: LeavingCard; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const animate = useAnimate()
  // Keep the latest callback without restarting the animation when the parent re-renders.
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })

  useEffect(() => {
    const from = cardTransform(card.from)
    // It stays solid until it's mostly off screen, so the eye can follow where the purchase went.
    void animate(
      ref.current,
      [
        { transform: from, opacity: 1 },
        { opacity: 1, offset: 0.75 },
        { transform: offscreen(card.dir, card.from), opacity: 0 },
      ],
      { duration: DURATION.fly, easing: EASE_FLY, hold: true },
      [
        { transform: from, opacity: 1 },
        { transform: from, opacity: 0 },
      ],
    ).then(() => done.current())
  }, [card, animate])

  const stamp = FLY_STAMP[card.dir]
  return (
    <div
      ref={ref}
      className="deck-card deck-card--leaving"
      style={{ transform: cardTransform(card.from) }}
      aria-hidden
    >
      <Stamp opacity={1} kind={stamp.kind} label={stamp.label} />
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
