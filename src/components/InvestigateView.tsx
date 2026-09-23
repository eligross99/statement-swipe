import { Check, ChevronLeft, Flag, ShieldAlert } from 'lucide-react'
import { useRef } from 'react'
import { useAnimate } from '../hooks/useAnimate'
import { useEscape } from '../hooks/useEscape'
import { formatDate } from '../lib/dates'
import { usd } from '../lib/format'
import type { Transaction } from '../types'
import './InvestigateView.css'

interface Props {
  txn: Transaction
  /** Whether approve/flag are offered (only for the card currently on top of the deck). */
  canDecide: boolean
  onBack: () => void
  onApprove: () => void
  onFlag: () => void
}

/** Full statement details for one purchase. "Back" leaves the card unresolved in the deck.
 *  Every way out slides the view away first, then reports back. */
export function InvestigateView({ txn, canDecide, onBack, onApprove, onFlag }: Props) {
  const animate = useAnimate()
  const ref = useRef<HTMLDivElement>(null)
  const leaving = useRef(false)

  const leave = (then: () => void) => {
    if (leaving.current) return
    leaving.current = true
    void animate(ref.current, [{ transform: 'translateX(0)' }, { transform: 'translateX(100%)' }], { hold: true }, [
      { opacity: 1 },
      { opacity: 0 },
    ]).then(then)
  }
  useEscape(() => leave(onBack))

  return (
    <div ref={ref} className="overlay motion-fade" role="dialog" aria-modal="true" aria-labelledby="investigate-title">
      <div className="overlay-inner">
        <div className="investigate-top">
          <button type="button" className="back-link" onClick={() => leave(onBack)} autoFocus>
            <ChevronLeft size={20} /> Back
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
