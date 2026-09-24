import { Archive, ArchiveRestore, Check, ChevronRight, FileText, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useAnimate } from '../hooks/useAnimate'
import { plural, usd } from '../lib/format'
import { openItems, sumAmounts } from '../lib/review'
import {
  FILTER_LABELS,
  filterStatements,
  progress,
  resumeCandidate,
  type Progress,
  type StatementFilter,
} from '../lib/statements'
import type { Statement } from '../types'
import { ConfirmSheet } from './ConfirmSheet'
import { RenameSheet } from './RenameSheet'
import { Sheet } from './Sheet'
import './StatementsScreen.css'

interface Props {
  statements: Statement[]
  filter: StatementFilter
  onFilter: (filter: StatementFilter) => void
  onOpen: (id: string) => void
  onImport: () => void
  onRename: (id: string, name: string) => void
  onArchive: (id: string, archived: boolean) => void
  onDelete: (id: string) => void
}

/** The "⋯" menu's follow-up sheets. */
type Pending = { kind: 'menu' | 'rename' | 'delete'; id: string } | null

const FILTERS: StatementFilter[] = ['all', 'action', 'archived']

/** The home screen: every statement on this device, newest first. */
export function StatementsScreen(props: Props) {
  const { statements, filter, onFilter, onOpen, onImport } = props
  const [pending, setPending] = useState<Pending>(null)
  const rows = useRef(new Map<string, HTMLLIElement>())
  const animate = useAnimate()

  const shown = filterStatements(statements, filter)
  // The banner only earns its place when the review isn't already the top row; otherwise it would
  // be a second button doing the same thing.
  const candidate = resumeCandidate(statements)
  const resume = candidate && shown[0]?.id !== candidate.id ? candidate : null
  const target = statements.find((st) => st.id === pending?.id) ?? null

  /** The row folds away, then the statement is archived or deleted, so the user sees where it went. */
  const removeRow = (id: string, then: () => void) => {
    const el = rows.current.get(id)
    const h = el?.offsetHeight ?? 0
    void animate(
      el ?? null,
      [
        { opacity: 1, height: `${h}px`, marginBottom: '10px' },
        { opacity: 0, height: '0px', marginBottom: '0px' },
      ],
      { duration: 320, hold: true },
      [{ opacity: 1 }, { opacity: 0 }],
    ).then(then)
  }

  return (
    <>
      <div className="screen st-screen">
        {statements.length === 0 ? (
          <div className="st-empty st-empty--first">
            <span className="st-empty-icon">
              <FileText size={26} />
            </span>
            <h2 className="st-empty-title">No statements yet</h2>
            <p className="muted">
              Import a statement PDF or CSV from your bank to review it one purchase at a time. It never leaves this
              device.
            </p>
          </div>
        ) : (
          <>
            {resume && <ResumeBanner statement={resume} onOpen={() => onOpen(resume.id)} />}

            <div className="st-filters" role="group" aria-label="Show statements">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`st-filter${f === filter ? ' is-on' : ''}`}
                  aria-pressed={f === filter}
                  onClick={() => onFilter(f)}
                >
                  {FILTER_LABELS[f]}
                </button>
              ))}
            </div>

            {/* Keyed by the filter, so the list fades in fresh when the filter changes. */}
            <div key={filter} className="enter-fade">
              {shown.length === 0 ? (
                <EmptyFilter filter={filter} />
              ) : (
                <ul className="st-list">
                  {shown.map((st) => (
                    <li
                      key={st.id}
                      className="panel st-row"
                      ref={(el) => {
                        if (el) rows.current.set(st.id, el)
                        else rows.current.delete(st.id)
                      }}
                    >
                      <button type="button" className="st-open" onClick={() => onOpen(st.id)}>
                        <span className="st-name">{st.name}</span>
                        <span className="st-meta">
                          {plural(st.session.txns.length, 'purchase')},{' '}
                          <span className="num">${usd(sumAmounts(st.session.txns))}</span>
                        </span>
                        <MiniLedger statement={st} />
                        <StatusLine p={progress(st)} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn icon-btn--flat st-more"
                        aria-label={`More for ${st.name}`}
                        onClick={() => setPending({ kind: 'menu', id: st.id })}
                      >
                        <MoreHorizontal size={20} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>

      <div className="st-footer">
        <button type="button" className="btn btn--primary" onClick={onImport}>
          <Plus size={18} /> Import a statement
        </button>
      </div>

      {pending?.kind === 'menu' && target && (
        <Sheet id="statement-menu-title" title={target.name} onDismiss={() => setPending(null)}>
          {(close) => (
            <div className="st-menu">
              <button
                type="button"
                className="st-menu-item"
                onClick={() => close(() => setPending({ kind: 'rename', id: target.id }))}
              >
                <Pencil size={18} /> Rename
              </button>
              <button
                type="button"
                className="st-menu-item"
                onClick={() =>
                  close(() => {
                    setPending(null)
                    removeRow(target.id, () => props.onArchive(target.id, !target.archived))
                  })
                }
              >
                {target.archived ? (
                  <>
                    <ArchiveRestore size={18} /> Move out of archive
                  </>
                ) : (
                  <>
                    <Archive size={18} /> Archive
                  </>
                )}
              </button>
              <button
                type="button"
                className="st-menu-item st-menu-item--flag"
                onClick={() => close(() => setPending({ kind: 'delete', id: target.id }))}
              >
                <Trash2 size={18} /> Delete
              </button>
            </div>
          )}
        </Sheet>
      )}

      {pending?.kind === 'rename' && target && (
        <RenameSheet
          name={target.name}
          onRename={(name) => {
            setPending(null)
            props.onRename(target.id, name)
          }}
          onClose={() => setPending(null)}
        />
      )}

      {pending?.kind === 'delete' && target && (
        <ConfirmSheet
          id="delete-statement-title"
          title={`Delete “${target.name}”?`}
          confirmLabel="Delete statement"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            setPending(null)
            removeRow(target.id, () => props.onDelete(target.id))
          }}
        >
          Its purchases, folders, and notes will be removed from this device. This can’t be undone.
        </ConfirmSheet>
      )}
    </>
  )
}

/** The review worked on most recently, one tap away. */
function ResumeBanner({ statement, onOpen }: { statement: Statement; onOpen: () => void }) {
  const p = progress(statement)
  return (
    <button type="button" className="st-resume" onClick={onOpen}>
      <span className="st-resume-text">
        <span className="st-resume-kicker">Pick up where you left off</span>
        <span className="st-resume-name">{statement.name}</span>
        <span className="st-resume-left">
          {p.left} of {plural(p.total, 'purchase')} left
        </span>
      </span>
      <ChevronRight size={20} />
    </button>
  )
}

/**
 * A slim version of the summary's breakdown bar: the statement's dollars by decision so far.
 * The empty part of the track is what's still to review.
 */
function MiniLedger({ statement }: { statement: Statement }) {
  const { txns } = statement.session
  const filed = txns.filter((t) => t.status === 'piled')
  const open = sumAmounts(openItems(filed))
  const segs = [
    { key: 'approve', amount: sumAmounts(txns.filter((t) => t.status === 'approved')) },
    { key: 'pile', amount: open },
    { key: 'settled', amount: sumAmounts(filed) - open },
    { key: 'flag', amount: sumAmounts(txns.filter((t) => t.status === 'flagged')) },
    { key: 'left', amount: sumAmounts(txns.filter((t) => t.status === 'unreviewed')) },
  ]
  return (
    <span className="st-ledger" aria-hidden>
      {segs.map(({ key, amount }) =>
        amount > 0 ? <span key={key} className={`st-seg st-seg--${key}`} style={{ flexGrow: amount }} /> : null,
      )}
    </span>
  )
}

/** Where the statement stands: not started, how many are left, or what still needs doing. */
function StatusLine({ p }: { p: Progress }) {
  if (p.stage === 'new') return <span className="st-status muted">Needs review</span>
  if (p.stage === 'progress')
    return (
      <span className="st-status muted">
        In progress, {p.left} of {p.total} left
      </span>
    )
  const tags = [
    { n: p.flagged, label: 'flagged', tone: 'flag' },
    { n: p.todo, label: 'to do', tone: 'todo' },
    { n: p.waiting, label: 'waiting', tone: 'wait' },
  ].filter((t) => t.n > 0)
  if (!tags.length)
    return (
      <span className="st-status">
        <span className="st-tag st-tag--clear">
          <Check size={14} aria-hidden /> Clear
        </span>
      </span>
    )
  return (
    <span className="st-status">
      {tags.map((t) => (
        <span key={t.tone} className={`st-tag st-tag--${t.tone}`}>
          {t.n} {t.label}
        </span>
      ))}
    </span>
  )
}

const EMPTY: Record<StatementFilter, { title: string; text: string }> = {
  all: { title: 'Every statement is archived', text: 'Tap Archived above to see them.' },
  action: { title: 'Nothing needs action', text: 'Every statement is reviewed and settled.' },
  archived: {
    title: 'No archived statements',
    text: 'To tuck a statement away, tap the ⋯ button beside it and choose Archive.',
  },
}

function EmptyFilter({ filter }: { filter: StatementFilter }) {
  const { title, text } = EMPTY[filter]
  return (
    <div className="st-empty">
      {filter === 'action' && (
        <span className="st-empty-icon st-empty-icon--clear">
          <Check size={24} />
        </span>
      )}
      <h2 className="st-empty-title">{title}</h2>
      <p className="muted">{text}</p>
    </div>
  )
}
