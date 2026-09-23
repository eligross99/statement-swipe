import { ChevronDown, Folder, FolderOpen, Pencil } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAnimate } from '../hooks/useAnimate'
import { formatDate } from '../lib/dates'
import { plural, usd } from '../lib/format'
import { ACTION_LABELS, openItems, pileItems, stillToActOn, sumAmounts } from '../lib/review'
import type { Action, Pile, Transaction } from '../types'
import { StatusSheet } from './StatusSheet'
import './FolderDetail.css'

interface Props {
  pile: Pile | null
  txns: Transaction[]
  onSetAction: (txnId: string, action: Action) => void
  onSetNote: (txnId: string, note: string) => void
}

/** One folder's purchases, each with a status and a note. The header's back button returns
 *  to all folders. */
export function FolderDetail({ pile, txns, onSetAction, onSetNote }: Props) {
  const [noteOpenId, setNoteOpenId] = useState<string | null>(null)
  const [statusForId, setStatusForId] = useState<string | null>(null)
  const rows = useRef(new Map<string, HTMLLIElement>())
  const animate = useAnimate()
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
            {items.map((t) => {
              const noteOpen = noteOpenId === t.id
              return (
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
                        {t.cat && t.cat !== '—' && <span className="fd-item-cat">{t.cat}</span>}
                      </span>
                    </div>
                    <span className="fd-item-amount num">${usd(t.amount)}</span>
                  </div>

                  <div className="fd-item-controls">
                    <button
                      type="button"
                      className={`status-pill${t.action ? ` status-pill--${t.action}` : ''}`}
                      onClick={() => setStatusForId(t.id)}
                      aria-haspopup="dialog"
                      aria-label={`Status: ${t.action ? ACTION_LABELS[t.action] : 'not set'}. Change status for ${t.desc}`}
                    >
                      <span className="status-dot" aria-hidden />
                      {t.action ? ACTION_LABELS[t.action] : 'Set status'}
                      <ChevronDown size={16} aria-hidden />
                    </button>
                    {!noteOpen && (
                      <button
                        type="button"
                        className={`note-pill${t.note ? ' has-note' : ''}`}
                        onClick={() => setNoteOpenId(t.id)}
                      >
                        <Pencil size={14} /> {t.note ? 'Edit note' : 'Add note'}
                      </button>
                    )}
                  </div>

                  {noteOpen ? (
                    <NoteEditor
                      value={t.note}
                      label={`Note for ${t.desc}`}
                      onChange={(note) => onSetNote(t.id, note)}
                      onDone={() => {
                        // Tidy stray spaces/blank lines so an "empty" note really is empty.
                        if (t.note.trim() !== t.note) onSetNote(t.id, t.note.trim())
                        setNoteOpenId(null)
                      }}
                    />
                  ) : (
                    t.note && (
                      <button type="button" className="fd-note" onClick={() => setNoteOpenId(t.id)} aria-label={`Edit note: ${t.note}`}>
                        {t.note}
                      </button>
                    )
                  )}
                </li>
              )
            })}
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
            // A gentle pulse on the row, so it's clear which purchase changed.
            void animate(rows.current.get(statusFor.id) ?? null, [
              { transform: 'scale(1)' },
              { transform: 'scale(1.025)' },
              { transform: 'scale(1)' },
            ])
          }}
        />
      )}
    </div>
  )
}

interface NoteEditorProps {
  value: string
  label: string
  onChange: (note: string) => void
  onDone: () => void
}

/** Sets a textarea's height to fit its text, so the whole note is always visible while typing. */
function fitHeight(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  // scrollHeight leaves out the borders; add them back or a scrollbar appears.
  el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`
}

/** A note field that grows with its text and opens with the cursor at the end. */
function NoteEditor({ value, label, onChange, onDone }: NoteEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  // Once, when the editor opens: focus it, put the cursor after the existing text, and size it.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
    fitHeight(el)
  }, [])

  return (
    <div className="fd-note-edit">
      <textarea
        ref={ref}
        className="text-input fd-textarea"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          fitHeight(e.target)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            onDone()
          }
        }}
        rows={2}
        maxLength={500}
        aria-label={label}
        placeholder="e.g. ask the ski trip group to Venmo their share"
      />
      <button type="button" className="btn btn--pile btn--auto fd-note-done" onClick={onDone}>
        Save
      </button>
    </div>
  )
}
