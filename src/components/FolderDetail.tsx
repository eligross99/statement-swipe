import { ChevronLeft, Folder, Pencil } from 'lucide-react'
import { useState } from 'react'
import { plural, usd } from '../lib/format'
import { nextAction, pileItems, stillToActOn, sumAmounts } from '../lib/review'
import type { Action, Pile, Transaction } from '../types'
import './FolderDetail.css'

interface Props {
  pile: Pile | null
  txns: Transaction[]
  onBack: () => void
  onSetAction: (txnId: string, action: Action) => void
  onSetNote: (txnId: string, note: string) => void
}

const ACTION_LABELS: Record<Exclude<Action, null>, string> = {
  todo: 'To do',
  waiting: 'Waiting',
  done: 'Done',
}

/** One folder's purchases, each with a next-step status and a note. */
export function FolderDetail({ pile, txns, onBack, onSetAction, onSetNote }: Props) {
  const [noteOpenId, setNoteOpenId] = useState<string | null>(null)
  if (!pile) return null

  const items = pileItems(txns, pile.id)
  const done = items.filter((t) => t.action === 'done').length

  return (
    <div className="screen">
      <button type="button" className="back-link" onClick={onBack}>
        <ChevronLeft size={20} /> All folders
      </button>

      <div className="fd-head">
        <span className="folder-card-icon fd-icon">
          <Folder size={22} />
        </span>
        <div className="fd-head-text">
          <h2 className="fd-title">{pile.name}</h2>
          <p className="muted fd-sub">
            {plural(items.length, 'item')} · <span className="num">${usd(sumAmounts(items))}</span> total
          </p>
        </div>
      </div>

      <div className="fd-stats">
        <div className="panel fd-stat">
          <p className="fd-stat-n num tone-investigate">${usd(stillToActOn(items))}</p>
          <p className="stat-label">Still to act on</p>
        </div>
        <div className="panel fd-stat">
          <p className="fd-stat-n num tone-approve">
            {done}/{items.length}
          </p>
          <p className="stat-label">Done</p>
        </div>
      </div>

      <p className="muted fd-hint">Tap the status to set your next step. Add a note for the details.</p>

      <ul className="fd-list">
        {items.map((t) => {
          const noteOpen = noteOpenId === t.id
          return (
            <li key={t.id} className="panel fd-item">
              <div className="fd-item-top">
                <div className="fd-item-main">
                  <span className="fd-item-desc">{t.desc}</span>
                  <span className="fd-item-meta">
                    {t.date || '—'}
                    {t.cat && t.cat !== '—' ? ` · ${t.cat}` : ''}
                  </span>
                </div>
                <span className="fd-item-amount num">${usd(t.amount)}</span>
              </div>

              <div className="fd-item-controls">
                <button
                  type="button"
                  className={`status-pill${t.action ? ` status-pill--${t.action}` : ''}`}
                  onClick={() => onSetAction(t.id, nextAction(t.action))}
                  aria-label={`Next step: ${t.action ? ACTION_LABELS[t.action] : 'not set'}. Tap to change.`}
                >
                  <span className="status-dot" aria-hidden />
                  {t.action ? ACTION_LABELS[t.action] : 'Set next step'}
                </button>
                <button
                  type="button"
                  className={`note-pill${t.note ? ' has-note' : ''}`}
                  onClick={() => setNoteOpenId(noteOpen ? null : t.id)}
                  aria-expanded={noteOpen}
                >
                  <Pencil size={14} /> {t.note ? 'Edit note' : 'Add note'}
                </button>
              </div>

              {t.note && !noteOpen && <p className="fd-note">{t.note}</p>}
              {noteOpen && (
                <div className="fd-note-edit">
                  <textarea
                    className="text-input fd-textarea"
                    value={t.note}
                    onChange={(e) => onSetNote(t.id, e.target.value)}
                    rows={2}
                    autoFocus
                    aria-label={`Note for ${t.desc}`}
                    placeholder="e.g. ask the ski trip group to Venmo their share"
                  />
                  <button type="button" className="btn btn--pile btn--auto fd-note-done" onClick={() => setNoteOpenId(null)}>
                    Done
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
