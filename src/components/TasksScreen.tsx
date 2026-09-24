import { Check, Clock, Folder, ListChecks, ShieldAlert } from 'lucide-react'
import { useRef, useState } from 'react'
import { useAnimate } from '../hooks/useAnimate'
import { useShowMore } from '../hooks/useShowMore'
import { usd } from '../lib/format'
import { allTasks, GROUP_LABELS, groupTasks, taskGroup, TASK_GROUPS, type Task, type TaskGroup } from '../lib/tasks'
import type { Action, Statement } from '../types'
import { InvestigateView } from './InvestigateView'
import { StatusSheet } from './StatusSheet'
import { StatusPill } from './TaskControls'
import './TasksScreen.css'

interface Props {
  statements: Statement[]
  /** The current time, for Overdue. */
  now: number
  remindAfterDays: number | null
  /** Opens a filed purchase in its folder. */
  onOpenFolder: (task: Task) => void
  onSetAction: (task: Task, action: Action) => void
  onSetNote: (task: Task, note: string) => void
  /** A flagged purchase the user recognizes after all. */
  onRecognize: (task: Task) => void
}

/** How many finished tasks show before "Show all". */
const DONE_ROWS = 5

/** Every purchase to follow up on, from every statement: possible fraud first, then by status. */
export function TasksScreen(props: Props) {
  const { statements, now, remindAfterDays } = props
  const [statusFor, setStatusFor] = useState<string | null>(null)
  const [inspecting, setInspecting] = useState<string | null>(null)
  // The task that just moved to another group, so it fades in where it landed.
  const [moved, setMoved] = useState<string | null>(null)
  const rows = useRef(new Map<string, HTMLLIElement>())
  const animate = useAnimate()

  const tasks = allTasks(statements, now, remindAfterDays)
  const groups = groupTasks(tasks)
  const find = (key: string | null) => tasks.find((t) => t.key === key) ?? null
  const statusTask = find(statusFor)
  const inspected = find(inspecting)
  const open = tasks.length - groups.done.length

  const rowRef = (key: string) => (el: HTMLLIElement | null) => {
    if (el) rows.current.set(key, el)
    else rows.current.delete(key)
  }

  /** A new status. If that moves the task to another group, its row folds away first, then it
   *  appears in its new place; otherwise the row pulses where it is. */
  const setStatus = (task: Task, action: Action) => {
    const el = rows.current.get(task.key) ?? null
    if (taskGroup({ ...task.txn, action }) === task.group) {
      props.onSetAction(task, action)
      void animate(el, [{ transform: 'scale(1)' }, { transform: 'scale(1.025)' }, { transform: 'scale(1)' }])
      return
    }
    const h = el?.offsetHeight ?? 0
    void animate(
      el,
      [
        { opacity: 1, height: `${h}px`, marginBottom: '10px' },
        { opacity: 0, height: '0px', marginBottom: '0px' },
      ],
      { duration: 320, hold: true },
      [{ opacity: 1 }, { opacity: 0 }],
    ).then(() => {
      setMoved(task.key)
      props.onSetAction(task, action)
    })
  }

  const row = (task: Task) => (
    <TaskRow
      key={task.key}
      task={task}
      rowRef={rowRef(task.key)}
      entering={task.key === moved}
      onOpen={() => (task.pile ? props.onOpenFolder(task) : setInspecting(task.key))}
      onStatus={() => setStatusFor(task.key)}
    />
  )

  return (
    <>
      <div className="screen tasks-screen">
        {tasks.length === 0 ? (
          <div className="tasks-empty">
            <span className="tasks-empty-icon">
              <ListChecks size={26} />
            </span>
            <h2 className="tasks-empty-title">Nothing to follow up on</h2>
            <p className="muted">
              When you file a purchase into a folder or flag one as possible fraud, it shows up here so you can track
              it until it’s done.
            </p>
          </div>
        ) : (
          <>
            {open === 0 && (
              <p className="panel tasks-clear">
                <Check size={18} aria-hidden /> You’re all caught up
              </p>
            )}
            {TASK_GROUPS.filter((g) => g !== 'done' && groups[g].length > 0).map((g) => (
              <section key={g} className="tasks-group" aria-labelledby={`tasks-${g}`}>
                <GroupTitle group={g} count={groups[g].length} />
                <ul className="tasks-list">{groups[g].map(row)}</ul>
              </section>
            ))}
            {groups.done.length > 0 && <DoneGroup tasks={groups.done} row={row} />}
          </>
        )}
      </div>

      {statusTask && (
        <StatusSheet
          txn={statusTask.txn}
          onClose={() => setStatusFor(null)}
          onPick={(action) => {
            setStatusFor(null)
            setStatus(statusTask, action)
          }}
        />
      )}

      {inspected && (
        <InvestigateView
          txn={inspected.txn}
          canDecide={false}
          onBack={() => setInspecting(null)}
          onApprove={() => undefined}
          onFlag={() => undefined}
          onRecognize={() => {
            setInspecting(null)
            props.onRecognize(inspected)
          }}
          onSetAction={(action) => props.onSetAction(inspected, action)}
          onSetNote={(note) => props.onSetNote(inspected, note)}
        />
      )}
    </>
  )
}

function GroupTitle({ group, count }: { group: TaskGroup; count: number }) {
  return (
    <h2 id={`tasks-${group}`} className={`section-label tasks-group-title tasks-group-title--${group}`}>
      {group === 'fraud' && <ShieldAlert size={17} aria-hidden />}
      {GROUP_LABELS[group]}
      <span className="tasks-count num">{count}</span>
    </h2>
  )
}

/** Finished tasks, most recent first: the first few, with "Show all" for the rest. */
function DoneGroup({ tasks, row }: { tasks: Task[]; row: (task: Task) => React.ReactNode }) {
  const { shown, all, hasMore, listRef, toggleRef, toggle } = useShowMore<Task, HTMLUListElement>(tasks, DONE_ROWS)
  return (
    <section className="tasks-group" aria-labelledby="tasks-done">
      <GroupTitle group="done" count={tasks.length} />
      <ul className="tasks-list" ref={listRef}>
        {shown.map(row)}
      </ul>
      {hasMore && (
        <button ref={toggleRef} type="button" className="btn btn--quiet tasks-more" aria-expanded={all} onClick={toggle}>
          {all ? 'Show fewer' : `Show all ${tasks.length}`}
        </button>
      )}
    </section>
  )
}

interface RowProps {
  task: Task
  rowRef: (el: HTMLLIElement | null) => void
  entering: boolean
  onOpen: () => void
  onStatus: () => void
}

/** One task: what and how much, where it lives, its status, and its note if it has one. */
function TaskRow({ task, rowRef, entering, onOpen, onStatus }: RowProps) {
  const { txn, pile, statement, overdue } = task
  return (
    <li ref={rowRef} className={`panel task-row${entering ? ' enter-fade' : ''}`}>
      <button type="button" className="task-open" onClick={onOpen}>
        <span className="task-top">
          <span className="task-desc">{txn.desc}</span>
          <span className={`task-amount num${task.group === 'fraud' ? ' tone-flag' : ''}`}>${usd(txn.amount)}</span>
        </span>
        <span className="task-meta">
          {pile && (
            <span className="task-folder">
              <Folder size={14} aria-hidden /> {pile.name}
            </span>
          )}
          {/* Where it came from, once it's left the Possible fraud group. */}
          {!pile && task.group !== 'fraud' && (
            <span className="task-folder task-folder--flag">
              <ShieldAlert size={14} aria-hidden /> Flagged
            </span>
          )}
          <span>{statement.name}</span>
        </span>
        {txn.note && <span className="task-note-preview">{txn.note}</span>}
      </button>
      <div className="task-row-controls">
        <StatusPill txn={txn} onClick={onStatus} />
        {overdue && (
          <span className="task-overdue">
            <Clock size={14} aria-hidden /> Overdue
          </span>
        )}
      </div>
    </li>
  )
}
