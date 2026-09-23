import { Check } from 'lucide-react'
import { usd } from '../lib/format'
import { ACTION_LABELS } from '../lib/review'
import type { Action, Transaction } from '../types'
import { Sheet } from './Sheet'
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
  return (
    <Sheet id="status-sheet-title" title="Set status" onDismiss={onClose}>
      {(close) => (
        <>
          <p className="muted status-sheet-sub">
            <span>{txn.desc}</span>
            <span className="num">${usd(txn.amount)}</span>
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
                  onClick={() => close(() => onPick(action))}
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
            <button type="button" className="btn btn--secondary status-clear" onClick={() => close(() => onPick(null))}>
              Clear status
            </button>
          )}
        </>
      )}
    </Sheet>
  )
}
