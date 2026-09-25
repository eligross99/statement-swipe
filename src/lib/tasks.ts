// The Tasks screen's list: every purchase that still needs following up, from every statement.
// Worked out from the statements each time (never stored), so it can't drift out of step with them.

import type { Pile, Statement, Transaction } from '../types'

/** Where a task stands: its status, with no status counting as To do. Flagged and filed purchases
 *  share the groups; flagged ones lead each group (see `groupTasks`). */
export type TaskGroup = 'todo' | 'waiting' | 'done'

export const TASK_GROUPS: TaskGroup[] = ['todo', 'waiting', 'done']

export const GROUP_LABELS: Record<TaskGroup, string> = {
  todo: 'To do',
  waiting: 'Waiting',
  done: 'Done',
}

export interface Task {
  /** Unique across statements (purchase ids are only unique within their statement). */
  key: string
  statement: Statement
  txn: Transaction
  /** The folder it's filed in, or null for a flagged purchase. */
  pile: Pile | null
  group: TaskGroup
  /** When it was filed or flagged, or its status last changed. */
  since: number
  /** Open for longer than the "Remind me after" setting. */
  overdue: boolean
}

export const DAY_MS = 24 * 60 * 60 * 1000

/** The "Remind me after" choices, in days (null = never mark anything Overdue). */
export const REMIND_CHOICES: { days: number | null; label: string }[] = [
  { days: 7, label: '1 week' },
  { days: 14, label: '2 weeks' },
  { days: 30, label: '1 month' },
  { days: 60, label: '2 months' },
  { days: null, label: 'Off' },
]

export function taskGroup(t: Transaction): TaskGroup {
  return t.action === 'done' || t.action === 'waiting' ? t.action : 'todo'
}

/**
 * Every filed or flagged purchase in statements that aren't archived, including statements still
 * being reviewed. `now` and `remindAfterDays` decide which open tasks are Overdue.
 */
export function allTasks(statements: Statement[], now: number, remindAfterDays: number | null): Task[] {
  const tasks: Task[] = []
  for (const statement of statements) {
    if (statement.archived) continue
    const { txns, piles } = statement.session
    for (const txn of txns) {
      const pile = txn.status === 'piled' ? (piles.find((p) => p.id === txn.pileId) ?? null) : null
      if (txn.status !== 'flagged' && !pile) continue
      const group = taskGroup(txn)
      // Purchases handled before task clocks existed count from the statement's last change.
      const since = txn.actionAt ?? statement.updatedAt
      const overdue = group !== 'done' && remindAfterDays !== null && now - since >= remindAfterDays * DAY_MS
      tasks.push({ key: `${statement.id}:${txn.id}`, statement, txn, pile, group, since, overdue })
    }
  }
  return tasks
}

const isFlag = (t: Task) => t.txn.status === 'flagged'

/**
 * Tasks by group. In To do and Waiting, possible fraud comes first (the most urgent), then the
 * longest-waiting. Done lists the most recently finished first.
 */
export function groupTasks(tasks: Task[]): Record<TaskGroup, Task[]> {
  const groups: Record<TaskGroup, Task[]> = { todo: [], waiting: [], done: [] }
  for (const task of tasks) groups[task.group].push(task)
  for (const g of TASK_GROUPS) {
    groups[g].sort((a, b) =>
      g === 'done' ? b.since - a.since : Number(isFlag(b)) - Number(isFlag(a)) || a.since - b.since,
    )
  }
  return groups
}

/** How many open tasks are overdue: the number on the Tasks tab. */
export function overdueCount(tasks: Task[]): number {
  return tasks.filter((t) => t.overdue).length
}
