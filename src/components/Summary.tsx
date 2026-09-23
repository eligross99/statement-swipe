import { ChevronRight, Folder, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { plural, usd } from '../lib/format'
import { openItems, pileItems, sumAmounts } from '../lib/review'
import type { Pile, Transaction } from '../types'
import './Summary.css'

interface Props {
  txns: Transaction[]
  piles: Pile[]
  onInspect: (t: Transaction) => void
  onOpenPile: (pileId: string) => void
  onRestart: () => void
  onNew: () => void
}

type Tone = 'approve' | 'pile' | 'flag'

export function Summary({ txns, piles, onInspect, onOpenPile, onRestart, onNew }: Props) {
  const [confirmRestart, setConfirmRestart] = useState(false)
  const total = sumAmounts(txns)
  const flagged = txns.filter((t) => t.status === 'flagged')
  const groups = piles.map((p) => ({ p, items: pileItems(txns, p.id) })).filter((g) => g.items.length)

  const rows: { tone: Tone; label: string; items: Transaction[] }[] = [
    { tone: 'approve', label: 'Approved', items: txns.filter((t) => t.status === 'approved') },
    { tone: 'pile', label: 'Filed', items: txns.filter((t) => t.status === 'piled') },
    { tone: 'flag', label: 'Flagged', items: flagged },
  ]

  return (
    <div className="screen">
      <h2 className="screen-title">Review complete</h2>
      <p className="muted summary-recon">
        All {plural(txns.length, 'purchase')} reviewed, <span className="num">${usd(total)}</span> in total.
      </p>

      {/* Where the statement's money went: one bar split by decision, then the numbers behind it. */}
      <section className="panel ledger" aria-label="Breakdown">
        <div className="ledger-bar" aria-hidden>
          {rows.map(({ tone, items }) => {
            const amount = sumAmounts(items)
            return amount > 0 ? <span key={tone} className={`ledger-seg ledger-seg--${tone}`} style={{ flexGrow: amount }} /> : null
          })}
        </div>
        <dl className="ledger-rows">
          {rows.map(({ tone, label, items }) => (
            <div key={tone} className="ledger-row">
              <dt>
                <span className={`ledger-dot ledger-seg--${tone}`} aria-hidden />
                {label}
              </dt>
              <dd className="ledger-count num">{items.length}</dd>
              <dd className="ledger-amount num">${usd(sumAmounts(items))}</dd>
            </div>
          ))}
        </dl>
      </section>

      {flagged.length > 0 && (
        <section className="summary-section">
          <h3 className="summary-flag-title">
            <ShieldAlert size={16} /> Flagged as possible fraud
          </h3>
          <p className="muted summary-flag-help">Call the number on the back of your card to dispute these.</p>
          <div className="panel">
            {flagged.map((t) => (
              <button key={t.id} type="button" className="summary-flag-row" onClick={() => onInspect(t)}>
                <span className="summary-flag-desc">{t.desc}</span>
                <span className="num tone-flag">${usd(t.amount)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {groups.length > 0 && (
        <section className="summary-section">
          <h3 className="section-label">Your folders</h3>
          <div className="summary-folders">
            {groups.map(({ p, items }) => {
              const open = openItems(items).length
              return (
                <button key={p.id} type="button" className="panel folder-card" onClick={() => onOpenPile(p.id)}>
                  <span className="folder-card-icon">
                    <Folder size={20} />
                  </span>
                  <span className="folder-card-main">
                    <span className="folder-card-name">{p.name}</span>
                    <span className="folder-card-meta">
                      {plural(items.length, 'purchase')},{' '}
                      {open > 0 ? (
                        <span className="tone-investigate">{open} to act on</span>
                      ) : (
                        <span className="tone-approve">all done</span>
                      )}
                    </span>
                  </span>
                  <span className="folder-card-total num">${usd(sumAmounts(items))}</span>
                  <ChevronRight size={18} className="muted" />
                </button>
              )
            })}
          </div>
        </section>
      )}

      {confirmRestart ? (
        <div className="panel summary-confirm" role="alert">
          <p>Start over? This clears every decision, folder, and note in this review.</p>
          <div className="btn-row">
            <button type="button" className="btn btn--secondary" onClick={() => setConfirmRestart(false)}>
              Keep my review
            </button>
            <button type="button" className="btn btn--flag" onClick={onRestart}>
              Start over
            </button>
          </div>
        </div>
      ) : (
        <div className="btn-row summary-actions">
          <button type="button" className="btn btn--secondary" onClick={() => setConfirmRestart(true)}>
            Start over
          </button>
          <button type="button" className="btn btn--primary" onClick={onNew}>
            New statement
          </button>
        </div>
      )}
    </div>
  )
}
