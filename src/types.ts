// Core data model. Matches docs/handoff.md §7. Every screen works only with these types,
// never with raw CSV rows or bank-API payloads (see TransactionSource).

/** Review state of a transaction on the deck. Everything but "unreviewed" is terminal. */
export type Status = 'unreviewed' | 'approved' | 'piled' | 'flagged'

/** Next-step triage state for a transaction inside a folder. */
export type Action = null | 'todo' | 'waiting' | 'done'

export type Screen = 'import' | 'deck' | 'summary' | 'pile'

export interface Transaction {
  id: string
  /** Raw statement descriptor (often cryptic, e.g. "SQ *DD BAR"). */
  desc: string
  /** Absolute value; sign conventions are normalized away at import. */
  amount: number
  /** ISO "YYYY-MM-DD" when the source date is readable, else the original text or "".
   *  Display it only through `formatDate` (src/lib/dates.ts). */
  date: string
  /** Category if the source provides one, else "—". */
  cat: string
  status: Status
  pileId: string | null
  action: Action
  note: string
  /** Heuristic "looks unusual" flag. */
  sus?: boolean
  /** Location, if known. */
  loc?: string | null
}

/** A session-scoped folder the user files purchases into. */
export interface Pile {
  id: string
  name: string
}

/** The whole review session, persisted as one blob in IndexedDB. */
export interface Session {
  txns: Transaction[]
  index: number
  piles: Pile[]
  screen: Screen
  label: string
  openPile: string | null
}

/** Anything that can produce normalized transactions: CSV now, bank sync later. */
export interface TransactionSource {
  load(): Promise<Transaction[]>
}
