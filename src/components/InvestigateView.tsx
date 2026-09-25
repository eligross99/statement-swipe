import { Check, Flag } from 'lucide-react'
import { useState } from 'react'
import { formatDate } from '../lib/dates'
import { hasCategory, usd } from '../lib/format'
import type { Action, Transaction } from '../types'
import { Sheet } from './Sheet'
import { SlideOver } from './SlideOver'
import { StatusSheet } from './StatusSheet'
import { TaskControls } from './TaskControls'
import './InvestigateView.css'

interface Props {
  txn: Transaction
  /** Whether approve/flag are offered (only for the card currently on top of the deck). */
  canDecide: boolean
  onBack: () => void
  onApprove: () => void
  onFlag: () => void
  /** For a purchase flagged earlier (opened from the summary or Tasks): the user recognizes it after all. */
  onRecognize: () => void
  /** For a purchase flagged earlier: track resolving it, with a status and a note. */
  onSetAction: (action: Action) => void
  onSetNote: (note: string) => void
}

/** Full statement details for one purchase. "Back" leaves the card unresolved in the deck.
 *  Every way out slides the view away first, then reports back. */
export function InvestigateView(props: Props) {
  const { txn, canDecide, onBack, onApprove, onFlag, onRecognize, onSetAction, onSetNote } = props
  // Asking "are you sure?" before a flagged purchase is approved.
  const [confirming, setConfirming] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)

  return (
    <SlideOver
      labelledBy="investigate-title"
      backLabel="Back"
      onBack={onBack}
      // While a sheet or the note is open, Escape closes only that.
      escapable={!confirming && !statusOpen && !noteOpen}
    >
      {(leave) => (
        <>
          <p className="investigate-amount num">${usd(txn.amount)}</p>
          <h2 id="investigate-title" className="investigate-desc">
            {txn.desc}
          </h2>

          <dl className="panel investigate-fields">
            <Field label="Transaction date" value={formatDate(txn.date, 'long')} />
            <Field label="Category" value={hasCategory(txn.cat) ? txn.cat : 'Not in statement'} />
            <Field label="Location" value={txn.loc || 'Not in statement'} />
            <Field label="Statement text" value={txn.desc} mono />
          </dl>

          <p className="muted investigate-note">
            This is everything your statement says about this purchase. Cryptic names often belong to a
            payment service, like SQ for Square, with the shop’s name after it.
          </p>

          {canDecide && (
            <div className="investigate-actions">
              <p className="investigate-question">Do you recognize this purchase?</p>
              <button type="button" className="btn btn--primary" onClick={() => leave(onApprove)}>
                <Check size={18} /> Yes, approve it
              </button>
              <button type="button" className="btn btn--flag" onClick={() => leave(onFlag)}>
                <Flag size={18} /> No, flag as possible fraud
              </button>
            </div>
          )}

          {!canDecide && txn.status === 'flagged' && (
            <section className="investigate-track" aria-labelledby="investigate-track-title">
              <h3 id="investigate-track-title" className="investigate-question">
                Where it stands
              </h3>
              <p className="muted investigate-hint">
                If it still isn’t yours, call the number on the back of your card. A status and a note help you keep
                track until it’s resolved.
              </p>
              {/* In a white card, like a folder's purchases, so the note's grey box stands out. */}
              <div className="panel investigate-track-card">
                <TaskControls
                  txn={txn}
                  noteOpen={noteOpen}
                  onNoteOpen={setNoteOpen}
                  onStatus={() => setStatusOpen(true)}
                  onSetNote={onSetNote}
                />
              </div>
            </section>
          )}

          {!canDecide && txn.status === 'flagged' && (
            <div className="investigate-actions">
              <p className="investigate-question">Recognize it now?</p>
              <p className="muted investigate-hint">
                If you’ve looked into it and it’s yours, move it to your approved purchases.
              </p>
              <button type="button" className="btn btn--primary" onClick={() => setConfirming(true)}>
                <Check size={18} /> I recognize it, approve it
              </button>
            </div>
          )}

          {statusOpen && (
            <StatusSheet
              txn={txn}
              onClose={() => setStatusOpen(false)}
              onPick={(action) => {
                setStatusOpen(false)
                onSetAction(action)
              }}
            />
          )}

          {confirming && (
            <Sheet id="recognize-title" title="Approve this purchase?" onDismiss={() => setConfirming(false)}>
              {(close) => (
                <>
                  <p className="investigate-confirm-text">
                    {txn.desc}, <span className="num">${usd(txn.amount)}</span>, moves from Flagged to Approved.
                    {txn.action && txn.action !== 'done' && ` ${OPEN_STATUS_NOTE[txn.action]}`}
                  </p>
                  <div className="btn-row">
                    <button type="button" className="btn btn--secondary" onClick={() => close()} autoFocus>
                      Cancel
                    </button>
                    {/* The sheet slides away, then the whole page does, back to the summary. */}
                    <button type="button" className="btn btn--primary" onClick={() => close(() => leave(onRecognize))}>
                      Yes, approve it
                    </button>
                  </div>
                </>
              )}
            </Sheet>
          )}
        </>
      )}
    </SlideOver>
  )
}

/** A gentle "are you sure?" when approving a flag that's still being looked into. */
const OPEN_STATUS_NOTE: Record<'todo' | 'waiting', string> = {
  todo: 'It’s marked To do, so there may still be something to check. Approve it anyway?',
  waiting: 'It’s marked Waiting, so you may still be hearing back from your bank. Approve it anyway?',
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="investigate-field">
      <dt>{label}</dt>
      <dd className={mono ? 'investigate-mono' : undefined}>{value}</dd>
    </div>
  )
}
