// Facts about saved statements, worked out from their purchases: names, progress, filters, and
// sorting for the Statements screen. Plain functions with no React, so they're easy to test.

import type { Statement, Transaction } from '../types'
import { pileItems, reviewedCount } from './review'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** The date a statement covers up to: its closing date when known, else its latest purchase date. */
export function statementPeriod(txns: Transaction[], closing: string | null = null): string | null {
  if (closing && ISO_DATE.test(closing)) return closing
  const dates = txns.map((t) => t.date).filter((d) => ISO_DATE.test(d))
  return dates.length ? dates.reduce((a, b) => (b > a ? b : a)) : null
}

/** "2026-07-13" → "July 2026". */
export function monthName(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}

/** `base`, or "base (2)", "base (3)"… if another statement already has that name. */
export function uniqueName(base: string, taken: string[]): string {
  const used = new Set(taken.map((n) => n.trim().toLowerCase()))
  if (!used.has(base.toLowerCase())) return base
  let n = 2
  while (used.has(`${base} (${n})`.toLowerCase())) n++
  return `${base} (${n})`
}

/** A new statement's name: its month (e.g. "July 2026") when the file has dates, else `fallback`. */
export function defaultName(period: string | null, fallback: string, taken: string[]): string {
  return uniqueName(period ? monthName(period) : fallback.trim() || 'Statement', taken)
}

export type Stage = 'new' | 'progress' | 'done'

export interface Progress {
  stage: Stage
  total: number
  /** Purchases not yet reviewed. */
  left: number
  flagged: number
  /** Filed purchases marked To do, or with no status yet. */
  todo: number
  /** Filed purchases waiting on someone else. */
  waiting: number
}

export function progress(st: Statement): Progress {
  const { txns, piles } = st.session
  const reviewed = reviewedCount(txns)
  const filed = piles.flatMap((p) => pileItems(txns, p.id))
  return {
    stage: reviewed === 0 ? 'new' : reviewed < txns.length ? 'progress' : 'done',
    total: txns.length,
    left: txns.length - reviewed,
    flagged: txns.filter((t) => t.status === 'flagged').length,
    todo: filed.filter((t) => t.action === null || t.action === 'todo').length,
    waiting: filed.filter((t) => t.action === 'waiting').length,
  }
}

/** True until every purchase is reviewed and nothing is flagged, to do, or waiting. */
export function needsAction(p: Progress): boolean {
  return p.stage !== 'done' || p.flagged + p.todo + p.waiting > 0
}

export type StatementFilter = 'all' | 'action' | 'archived'

export const FILTER_LABELS: Record<StatementFilter, string> = {
  all: 'All',
  action: 'Needs action',
  archived: 'Archived',
}

/** Newest statement first, by the date it covers (or when it was imported, if it has no dates). */
function sortKey(st: Statement): string {
  return st.period ?? new Date(st.addedAt).toISOString().slice(0, 10)
}

export function sortStatements(list: Statement[]): Statement[] {
  return [...list].sort((a, b) => sortKey(b).localeCompare(sortKey(a)) || b.addedAt - a.addedAt)
}

/** The statements a filter shows, newest first. Archived ones only appear under Archived. */
export function filterStatements(list: Statement[], filter: StatementFilter): Statement[] {
  const shown = list.filter((st) =>
    filter === 'archived' ? st.archived : !st.archived && (filter === 'all' || needsAction(progress(st))),
  )
  return sortStatements(shown)
}

/** How many past folder names the filing sheet offers. */
const PAST_FOLDERS = 6

/**
 * Folder names used in other statements, most recently used first, to offer as one-tap choices
 * when filing. Skips names this statement already has, and folders that ended up empty.
 */
export function pastFolderNames(list: Statement[], current: Statement): string[] {
  const have = new Set(current.session.piles.map((p) => p.name.toLowerCase()))
  const names: string[] = []
  const others = list.filter((st) => st.id !== current.id).sort((a, b) => b.updatedAt - a.updatedAt)
  for (const st of others) {
    for (const pile of st.session.piles) {
      const key = pile.name.toLowerCase()
      if (have.has(key) || !pileItems(st.session.txns, pile.id).length) continue
      have.add(key)
      names.push(pile.name)
    }
  }
  return names.slice(0, PAST_FOLDERS)
}
