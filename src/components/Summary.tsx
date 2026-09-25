import { Check, ChevronRight, Folder, FolderCheck, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { plural, usd } from '../lib/format'
import { folderGroups, isOpenFlag, ledgerSegments, stillToActOn, sumAmounts, type FolderGroup } from '../lib/review'
import type { Pile, Transaction } from '../types'
import { StatusTag } from './TaskControls'
import './Summary.css'

interface Props {
  txns: Transaction[]
  piles: Pile[]
  onInspect: (t: Transaction) => void
  onOpenPile: (pileId: string) => void
  onRestart: () => void
}

type Tone = 'approve' | 'pile' | 'flag'

export function Summary({ txns, piles, onInspect, onOpenPile, onRestart }: Props) {
  const [confirmRestart, setConfirmRestart] = useState(false)
  const total = sumAmounts(txns)
  const flagged = txns.filter((t) => t.status === 'flagged')
  const openFlags = flagged.filter(isOpenFlag).length
  const filed = txns.filter((t) => t.status === 'piled')
  const groups = folderGroups(txns, piles)
  const needAction = groups.filter((g) => g.open > 0)
  const settledGroups = groups.filter((g) => g.open === 0)
  // Filed purchases stay filed as a record; this says whether any of them still need doing.
  const toActOn = stillToActOn(filed)

  // Same rule as the Statements list: done on the left, still to do on the right, and one solid
  // green once nothing is left to do.
  const bar = ledgerSegments(txns)
  const clear = toActOn === 0 && openFlags === 0

  const rows: { tone: Tone; label: string; items: Transaction[] }[] = [
    { tone: 'approve', label: 'Approved', items: txns.filter((t) => t.status === 'approved') },
    { tone: 'pile', label: 'Filed', items: filed },
    { tone: 'flag', label: 'Flagged', items: flagged },
  ]

  function dotTone(tone: Tone, items: Transaction[]): string {
    const open = tone === 'pile' ? toActOn > 0 : tone === 'flag' ? openFlags > 0 : true
    if (tone === 'approve' || !items.length || open) return tone
    return clear ? 'approve' : 'settled'
  }

  return (
    <div className="screen">
      <h2 className="screen-title">Review complete</h2>
      <p className="muted summary-recon">
        All {plural(txns.length, 'purchase')} reviewed, <span className="num">${usd(total)}</span> in total.
      </p>

      {/* Where the statement's money went: one bar split by decision, then the numbers behind it. */}
      <section className="panel ledger" aria-label="Breakdown">
        <div className="ledger-bar" aria-hidden>
          {bar.map(({ key, amount }) =>
            <span key={key} className={`ledger-seg ledger-seg--${key}`} style={{ flexGrow: amount }} />
          )}
        </div>
        <dl className="ledger-rows">
          {rows.map(({ tone, label, items }) => (
            <div key={tone} className="ledger-row">
              <dt>
                {/* Filed's and Flagged's dots match their part of the bar: pale green once settled or
                    resolved, solid when all clear. */}
                <span className={`ledger-dot ledger-seg--${dotTone(tone, items)}`} aria-hidden />
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
          <p className="muted summary-flag-help">
            {openFlags
              ? 'Tap one to look into it and track it until it’s resolved.'
              : 'All resolved. Tap one to see its details.'}
          </p>
          <div className="panel">
            {flagged.map((t) => (
              <button key={t.id} type="button" className="summary-flag-row" onClick={() => onInspect(t)}>
                <span className="summary-flag-main">
                  <span className="summary-flag-desc">{t.desc}</span>
                  {t.action && <StatusTag action={t.action} />}
                </span>
                <span className={`num${isOpenFlag(t) ? ' tone-flag' : ''}`}>${usd(t.amount)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {groups.length > 0 && (
        <section className="summary-section">
          {/* Filed purchases stay filed as a record; this says whether any still need doing. */}
          <div className="summary-folders-head">
            <h3 className="section-label">Your folders</h3>
            {toActOn > 0 ? (
              <span className="summary-folders-status tone-investigate">
                <span className="num">${usd(toActOn)}</span> still to act on
              </span>
            ) : (
              <span className="summary-folders-status tone-approve">
                <Check size={15} aria-hidden /> All settled
              </span>
            )}
          </div>
          {/* Two groups when both exist: folders needing action on top, settled below. Folders move
              between them on their own as statuses change. With only one group, the status beside
              the heading already says which it is. */}
          {needAction.length > 0 && settledGroups.length > 0 ? (
            <>
              <h4 className="summary-folders-group">Action needed</h4>
              <FolderList groups={needAction} onOpen={onOpenPile} />
              <h4 className="summary-folders-group summary-folders-group--settled">Settled</h4>
              <FolderList groups={settledGroups} onOpen={onOpenPile} />
            </>
          ) : (
            <FolderList groups={groups} onOpen={onOpenPile} />
          )}
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
        // New statements are imported from the Statements screen (the back arrow at the top left).
        <button type="button" className="btn btn--secondary summary-actions" onClick={() => setConfirmRestart(true)}>
          Start over
        </button>
      )}
    </div>
  )
}

function FolderList({ groups, onOpen }: { groups: FolderGroup[]; onOpen: (pileId: string) => void }) {
  return (
    <div className="summary-folders">
      {groups.map(({ pile: p, items, open }) => {
        const settled = open === 0
        return (
          <button
            key={p.id}
            type="button"
            className={`panel folder-card${settled ? ' is-settled' : ''}`}
            onClick={() => onOpen(p.id)}
          >
            <span className="folder-card-icon">{settled ? <FolderCheck size={20} /> : <Folder size={20} />}</span>
            <span className="folder-card-main">
              <span className="folder-card-top">
                <span className="folder-card-name">{p.name}</span>
                <span className="folder-card-total num">${usd(sumAmounts(items))}</span>
              </span>
              <span className="folder-card-meta">
                {plural(items.length, 'purchase')},{' '}
                {settled ? (
                  <span className="tone-approve">all settled</span>
                ) : (
                  <span className="tone-investigate">{open} to act on</span>
                )}
              </span>
            </span>
            <ChevronRight size={18} className="muted" />
          </button>
        )
      })}
    </div>
  )
}
