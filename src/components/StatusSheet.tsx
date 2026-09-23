import { Check, X } from 'lucide-react'
import { useEscape } from '../hooks/useEscape'
import { usd } from '../lib/format'
import { ACTION_LABELS } from '../lib/review'
import type { Action, Transaction } from '../types'
import './StatusSheet.css'

interface Props {
  txn: Transaction
  onPick: (action: Action) => void
  onClose: () => void
}

type SetAction = Exclude<Action, null>

const OPTIONS: { action: SetAction; hint: string }[] = [
  { action: 'todo', hint: 'You still need to do something' },
  { action: 'waiting', hint: 'Waiting on someone else' },
  { action: 'done', hint: 'Settled, nothing left to do' },
]

/** Bottom sheet for setting a folder item's status: To do, Waiting, Done, or cleared. */
export function StatusSheet({ txn, onPick, onClose }: Props) {
  useEscape(onClose)

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="status-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <h2 id="status-sheet-title" className="sheet-title">
            Set status
          </h2>
          <button type="button" className="icon-btn icon-btn--flat" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <p className="muted status-sheet-sub">
          {txn.desc} · <span className="num">${usd(txn.amount)}</span>
        </p>

        <div className="status-options">
          {OPTIONS.map(({ action, hint }, i) => {
            const selected = txn.action === action
            return (
              <button
                key={action}
                type="button"
                className={`status-option status-option--${action}${selected ? ' is-selected' : ''}`}
                aria-pressed={selected}
                onClick={() => onPick(action)}
                // Focus lands on the current status (or the first) so keyboards can pick right away.
                autoFocus={selected || (!txn.action && i === 0)}
              >
                <span className="status-option-dot" aria-hidden />
                <span className="status-option-text">
                  <span className="status-option-label">{ACTION_LABELS[action]}</span>
                  <span className="status-option-hint">{hint}</span>
                </span>
                {selected && <Check size={20} className="status-option-check" aria-hidden />}
              </button>
            )
          })}
        </div>

        {txn.action && (
          <button type="button" className="btn btn--secondary status-clear" onClick={() => onPick(null)}>
            Clear status
          </button>
        )}
      </div>
    </div>
  )
}
