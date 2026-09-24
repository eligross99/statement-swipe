import { Check, ChevronLeft, Flag, ShieldAlert } from 'lucide-react'
import { useRef, useState } from 'react'
import { useAnimate } from '../hooks/useAnimate'
import { useEscape } from '../hooks/useEscape'
import { formatDate } from '../lib/dates'
import { usd } from '../lib/format'
import type { Transaction } from '../types'
import { Sheet } from './Sheet'
import './InvestigateView.css'

interface Props {
  txn: Transaction
  /** Whether approve/flag are offered (only for the card currently on top of the deck). */
  canDecide: boolean
  onBack: () => void
  onApprove: () => void
  onFlag: () => void
  /** For a purchase flagged earlier (opened from the summary): the user recognizes it after all. */
  onRecognize: () => void
}

/** Full statement details for one purchase. "Back" leaves the card unresolved in the deck.
 *  Every way out slides the view away first, then reports back. */
export function InvestigateView({ txn, canDecide, onBack, onApprove, onFlag, onRecognize }: Props) {
  const animate = useAnimate()
  const ref = useRef<HTMLDivElement>(null)
  const leaving = useRef(false)
  // Asking "are you sure?" before a flagged purchase is approved.
  const [confirming, setConfirming] = useState(false)

  const leave = (then: () => void) => {
    if (leaving.current) return
    leaving.current = true
    void animate(ref.current, [{ transform: 'translateX(0)' }, { transform: 'translateX(100%)' }], { hold: true }, [
      { opacity: 1 },
      { opacity: 0 },
    ]).then(then)
  }
  // While the confirmation is open, Escape closes only that.
  useEscape(() => !confirming && leave(onBack))

  return (
    <div ref={ref} className="overlay motion-fade" role="dialog" aria-modal="true" aria-labelledby="investigate-title">
      <div className="overlay-inner">
        <div className="investigate-top">
          {/* Same round back button, in the same spot, as the header on other screens. */}
          <button type="button" className="icon-btn" onClick={() => leave(onBack)} aria-label="Back" autoFocus>
            <ChevronLeft size={22} />
          </button>
          {txn.sus && (
            <span className="investigate-badge">
              <ShieldAlert size={14} /> Unusual
            </span>
          )}
        </div>

        <p className="investigate-amount num">${usd(txn.amount)}</p>
        <h2 id="investigate-title" className="investigate-desc">
          {txn.desc}
        </h2>

        <dl className="panel investigate-fields">
          <Field label="Transaction date" value={formatDate(txn.date, 'long')} />
          <Field label="Category" value={txn.cat} />
          <Field label="Location" value={txn.loc || 'Not in statement'} />
          <Field label="Statement text" value={txn.desc} mono />
        </dl>

        <p className="note-box investigate-note">
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

        {confirming && (
          <Sheet id="recognize-title" title="Approve this purchase?" onDismiss={() => setConfirming(false)}>
            {(close) => (
              <>
                <p className="investigate-confirm-text">
                  {txn.desc}, <span className="num">${usd(txn.amount)}</span>, moves from Flagged to Approved.
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
      </div>
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="investigate-field">
      <dt>{label}</dt>
      <dd className={mono ? 'investigate-mono' : undefined}>{value}</dd>
    </div>
  )
}
