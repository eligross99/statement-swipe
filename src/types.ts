// Core data model. Matches docs/handoff.md §7. Every screen works only with these types,
// never with raw CSV rows or bank-API payloads (see TransactionSource).

/** Review state of a transaction on the deck. Everything but "unreviewed" is terminal. */
export type Status = 'unreviewed' | 'approved' | 'piled' | 'flagged'

/** Next-step triage state for a purchase in a folder, or a flagged purchase being resolved.
 *  A flagged purchase marked "done" is resolved (e.g. refunded) and no longer needs action. */
export type Action = null | 'todo' | 'waiting' | 'done'

/** Where the user is inside one statement's review. */
export type Screen = 'deck' | 'summary' | 'pile'

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
  /** When this purchase last became a task or changed status: filed, flagged, or given a status
   *  (milliseconds since 1970). Tasks marks it Overdue once it sits too long. Missing on purchases
   *  handled before Phase 6c; those count from the statement's last change instead. */
  actionAt?: number
  note: string
  /** Heuristic "looks unusual" flag. */
  sus?: boolean
  /** Location, if known. */
  loc?: string | null
}

/** A statement-scoped folder the user files purchases into. */
export interface Pile {
  id: string
  name: string
}

/** One statement's review: its purchases, decisions, and folders. */
export interface Session {
  txns: Transaction[]
  index: number
  piles: Pile[]
  screen: Screen
  openPile: string | null
}

/** What undo needs to put one resolved card back. */
export interface UndoEntry {
  txnId: string
  index: number
  status: Status
  pileId: string | null
}

/** One imported statement, saved on this device as a row in IndexedDB (see src/lib/storage.ts). */
export interface Statement {
  id: string
  /** Shown everywhere; the user can rename it. Defaults to the statement's month, e.g. "July 2026". */
  name: string
  /** When it was imported and last changed (milliseconds since 1970). */
  addedAt: number
  updatedAt: number
  /** The date the statement covers up to, "YYYY-MM-DD": a PDF's closing date, else the latest
   *  purchase date. Null when the file had no readable dates. Sorts the Statements list. */
  period: string | null
  archived: boolean
  session: Session
  /** Undo steps, so undo still works after leaving and reopening the app. */
  history: UndoEntry[]
}

/** Anything that can produce normalized transactions: CSV now, bank sync later. */
export interface TransactionSource {
  load(): Promise<Transaction[]>
}
