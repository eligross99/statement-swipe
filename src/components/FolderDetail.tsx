import { Folder, FolderOpen } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAnimate } from '../hooks/useAnimate'
import { canAnimate, token } from '../lib/motion'
import { formatDate } from '../lib/dates'
import { hasCategory, plural, usd } from '../lib/format'
import { openItems, pileItems, stillToActOn, sumAmounts } from '../lib/review'
import type { Action, Pile, Transaction } from '../types'
import { StatusSheet } from './StatusSheet'
import { TaskControls } from './TaskControls'
import './FolderDetail.css'

interface Props {
  pile: Pile | null
  txns: Transaction[]
  onSetAction: (txnId: string, action: Action) => void
  onSetNote: (txnId: string, note: string) => void
  /** A purchase to bring into view and highlight once (when opened from Tasks). */
  focusId?: string | null
}

/**
 * Scrolls the nearest scrolling box so `el` sits in its middle. Only up and down: unlike
 * `scrollIntoView`, it can't nudge the app sideways while a screen is still sliding in.
 */
function scrollToMiddle(el: HTMLElement) {
  let box = el.parentElement
  while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement
  if (!box) return
  const offset = el.getBoundingClientRect().top - box.getBoundingClientRect().top
  box.scrollTop += offset - (box.clientHeight - el.offsetHeight) / 2
}

/** A gentle pulse on a row, so it's clear which purchase changed. */
const PULSE: Keyframe[] = [{ transform: 'scale(1)' }, { transform: 'scale(1.025)' }, { transform: 'scale(1)' }]

/** One folder's purchases, each with a status and a note. The header's back button returns
 *  to all folders. */
export function FolderDetail({ pile, txns, onSetAction, onSetNote, focusId }: Props) {
  const [noteOpenId, setNoteOpenId] = useState<string | null>(null)
  const [statusForId, setStatusForId] = useState<string | null>(null)
  const rows = useRef(new Map<string, HTMLLIElement>())
  const animate = useAnimate()

  // Arriving from Tasks: scroll to that purchase and highlight it in the folder color. The highlight
  // holds long enough to notice, then fades. A color change, not movement, so it plays even with
  // Reduce Motion on.
  useEffect(() => {
    const el = (focusId && rows.current.get(focusId)) || null
    if (!el) return
    scrollToMiddle(el)
    if (!canAnimate()) return
    const [tint, ring, surface, shadow] = ['--pile-tint', '--pile-soft', '--surface', '--shadow-card'].map(token)
    const lit = { backgroundColor: tint, boxShadow: `0 0 0 2px ${ring}, ${shadow}` }
    const highlight = el.animate(
      [lit, { ...lit, offset: 0.6 }, { backgroundColor: surface, boxShadow: `0 0 0 0 transparent, ${shadow}` }],
      { duration: 2200, easing: 'ease-out' },
    )
    return () => highlight.cancel()
  }, [focusId])
  if (!pile) return null

  const items = pileItems(txns, pile.id)
  const settled = items.length > 0 && openItems(items).length === 0
  const done = items.filter((t) => t.action === 'done').length
  const statusFor = items.find((t) => t.id === statusForId) ?? null

  return (
    <div className="screen">
      <div className="fd-head">
        <span className="folder-card-icon fd-icon">
          <Folder size={22} />
        </span>
        <div className="fd-head-text">
          <h2 className="fd-title">{pile.name}</h2>
          <p className="muted fd-sub">
            {plural(items.length, 'purchase')}, <span className="num">${usd(sumAmounts(items))}</span>
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="panel fd-empty">
          <FolderOpen size={28} />
          <p className="fd-empty-title">This folder is empty</p>
          <p className="muted">Purchases you file here will show up for follow-up.</p>
        </div>
      ) : (
        <>
          {/* How much is left: the open amount, and a bar that fills as purchases are marked Done. */}
          <div className="panel fd-progress">
            <div className="fd-progress-top">
              <p className={`fd-progress-amount num ${settled ? 'tone-approve' : 'tone-investigate'}`}>
                ${usd(stillToActOn(items))}
              </p>
              <p className="muted fd-progress-done num">
                {done} of {items.length} done
              </p>
            </div>
            <p className="fd-progress-label">{settled ? 'All settled' : 'Still to act on'}</p>
            <div className="fd-progress-track" aria-hidden>
              <div className="fd-progress-fill" style={{ width: `${(done / items.length) * 100}%` }} />
            </div>
          </div>

          {!settled && <p className="muted fd-hint">Set a status to track what’s left. Add a note for the details.</p>}

          <ul className="fd-list">
            {items.map((t) => (
              <li
                key={t.id}
                className="panel fd-item"
                ref={(el) => {
                  if (el) rows.current.set(t.id, el)
                  else rows.current.delete(t.id)
                }}
              >
                <div className="fd-item-top">
                  <div className="fd-item-main">
                    <span className="fd-item-desc">{t.desc}</span>
                    <span className="fd-item-meta">
                      <span>{formatDate(t.date)}</span>
                      {hasCategory(t.cat) && <span className="fd-item-cat">{t.cat}</span>}
                    </span>
                  </div>
                  <span className="fd-item-amount num">${usd(t.amount)}</span>
                </div>

                <TaskControls
                  txn={t}
                  noteOpen={noteOpenId === t.id}
                  onNoteOpen={(open) => setNoteOpenId(open ? t.id : null)}
                  onStatus={() => setStatusForId(t.id)}
                  onSetNote={(note) => onSetNote(t.id, note)}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {statusFor && (
        <StatusSheet
          txn={statusFor}
          onClose={() => setStatusForId(null)}
          onPick={(action) => {
            onSetAction(statusFor.id, action)
            setStatusForId(null)
            void animate(rows.current.get(statusFor.id) ?? null, PULSE)
          }}
        />
      )}
    </div>
  )
}
