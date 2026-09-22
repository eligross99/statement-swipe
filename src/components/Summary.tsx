import { ChevronRight, CircleCheck, Folder, ShieldAlert } from 'lucide-react'
import { plural, usd } from '../lib/format'
import { pileItems, sumAmounts } from '../lib/review'
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

export function Summary({ txns, piles, onInspect, onOpenPile, onRestart, onNew }: Props) {
  const total = sumAmounts(txns)
  const approved = txns.filter((t) => t.status === 'approved')
  const piled = txns.filter((t) => t.status === 'piled')
  const flagged = txns.filter((t) => t.status === 'flagged')
  const groups = piles.map((p) => ({ p, items: pileItems(txns, p.id) })).filter((g) => g.items.length)

  return (
    <div className="screen">
      <div className="summary-hero">
        <CircleCheck size={44} className="tone-approve" />
        <h2 className="screen-title">Review complete</h2>
        <p className="muted num summary-recon">
          {txns.length} of {txns.length} reviewed · ${usd(total)} of ${usd(total)}
        </p>
      </div>

      <div className="stat-grid">
        <Stat n={approved.length} label="Approved" tone="approve" />
        <Stat n={piled.length} label="Filed" tone="pile" />
        <Stat n={flagged.length} label="Flagged" tone="flag" />
      </div>

      {flagged.length > 0 && (
        <section className="summary-section">
          <h3 className="summary-flag-title">
            <ShieldAlert size={16} /> Flagged for fraud
          </h3>
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
              const open = items.filter((t) => t.action !== 'done').length
              return (
                <button key={p.id} type="button" className="panel folder-card" onClick={() => onOpenPile(p.id)}>
                  <span className="folder-card-icon">
                    <Folder size={20} />
                  </span>
                  <span className="folder-card-main">
                    <span className="folder-card-name">{p.name}</span>
                    <span className="folder-card-meta">
                      {plural(items.length, 'item')}
                      {open > 0 && <span className="tone-investigate"> · {open} to act on</span>}
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

      <div className="btn-row summary-actions">
        <button type="button" className="btn btn--secondary" onClick={onRestart}>
          Start over
        </button>
        <button type="button" className="btn btn--primary" onClick={onNew}>
          New statement
        </button>
      </div>
    </div>
  )
}

function Stat({ n, label, tone }: { n: number; label: string; tone: 'approve' | 'pile' | 'flag' }) {
  return (
    <div className="panel stat">
      <p className={`stat-n num tone-${tone}`}>{n}</p>
      <p className="stat-label">{label}</p>
    </div>
  )
}
