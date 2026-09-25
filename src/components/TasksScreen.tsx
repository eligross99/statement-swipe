import { Check, Clock, Folder, ListChecks, ShieldAlert } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { useAnimate } from '../hooks/useAnimate'
import { useShowMore } from '../hooks/useShowMore'
import { usd } from '../lib/format'
import { DURATION, EASE_OUT } from '../lib/motion'
import { isOpenFlag } from '../lib/review'
import { allTasks, GROUP_LABELS, groupTasks, taskGroup, TASK_GROUPS, type Task, type TaskGroup } from '../lib/tasks'
import type { Action, Statement } from '../types'
import { FolderDetail } from './FolderDetail'
import { InvestigateView } from './InvestigateView'
import { SlideOver } from './SlideOver'
import { StatusSheet } from './StatusSheet'
import { StatusPill } from './TaskControls'
import './TasksScreen.css'

interface Props {
  statements: Statement[]
  /** The current time, for Overdue. */
  now: number
  remindAfterDays: number | null
  /** Changes to a purchase in statement `statementId` (from a task, or its folder opened here). */
  onSetAction: (statementId: string, txnId: string, action: Action) => void
  onSetNote: (statementId: string, txnId: string, note: string) => void
  /** A flagged purchase the user recognizes after all. */
  onRecognize: (statementId: string, txnId: string) => void
}

/** How many finished tasks show before "Show all". */
const DONE_ROWS = 5

/** Every purchase to follow up on, from every statement, by status. Possible fraud leads each group. */
export function TasksScreen(props: Props) {
  const { statements, now, remindAfterDays } = props
  const [statusFor, setStatusFor] = useState<string | null>(null)
  // The task opened on its own page: Look closer for a flag, its folder for a filed purchase.
  const [inspecting, setInspecting] = useState<string | null>(null)
  const [inFolder, setInFolder] = useState<string | null>(null)
  // The task that just moved to another group, so it grows into place where it landed.
  const [moved, setMoved] = useState<string | null>(null)
  const rows = useRef(new Map<string, HTMLLIElement>())
  const animate = useAnimate()

  const tasks = allTasks(statements, now, remindAfterDays)
  const groups = groupTasks(tasks)
  const find = (key: string | null) => tasks.find((t) => t.key === key) ?? null
  const statusTask = find(statusFor)
  const inspected = find(inspecting)
  // Kept while a status change moves it to another group (its key stays the same).
  const folderTask = find(inFolder)
  const open = tasks.length - groups.done.length

  const rowRef = (key: string) => (el: HTMLLIElement | null) => {
    if (el) rows.current.set(key, el)
    else rows.current.delete(key)
  }

  /** A new status. If that moves the task to another group, its row folds away first, then grows
   *  into its new place; otherwise the row pulses where it is. */
  const setStatus = (task: Task, action: Action) => {
    const el = rows.current.get(task.key) ?? null
    const setAction = () => props.onSetAction(task.statement.id, task.txn.id, action)
    if (taskGroup({ ...task.txn, action }) === task.group) {
      setAction()
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
      { duration: DURATION.move, easing: EASE_OUT, hold: true },
      [{ opacity: 1 }, { opacity: 0 }],
    ).then(() => {
      setMoved(task.key)
      setAction()
    })
  }

  const row = (task: Task) => (
    <TaskRow
      key={task.key}
      task={task}
      rowRef={rowRef(task.key)}
      entering={task.key === moved}
      onEntered={() => setMoved(null)}
      onOpen={() => (task.pile ? setInFolder(task.key) : setInspecting(task.key))}
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
            props.onRecognize(inspected.statement.id, inspected.txn.id)
          }}
          onSetAction={(action) => props.onSetAction(inspected.statement.id, inspected.txn.id, action)}
          onSetNote={(note) => props.onSetNote(inspected.statement.id, inspected.txn.id, note)}
        />
      )}

      {/* A filed purchase opens its folder the same way Look closer opens: sliding over Tasks. */}
      {folderTask?.pile && (
        <SlideOver label={folderTask.pile.name} backLabel="Back to tasks" onBack={() => setInFolder(null)}>
          {() => (
            <FolderDetail
              pile={folderTask.pile}
              txns={folderTask.statement.session.txns}
              onSetAction={(txnId, action) => props.onSetAction(folderTask.statement.id, txnId, action)}
              onSetNote={(txnId, note) => props.onSetNote(folderTask.statement.id, txnId, note)}
              focusId={folderTask.txn.id}
            />
          )}
        </SlideOver>
      )}
    </>
  )
}

function GroupTitle({ group, count }: { group: TaskGroup; count: number }) {
  return (
    <h2 id={`tasks-${group}`} className={`section-label tasks-group-title tasks-group-title--${group}`}>
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
  /** Just moved here from another group: grows into place. */
  entering: boolean
  onEntered: () => void
  onOpen: () => void
  onStatus: () => void
}

/** How far apart rows sit (their bottom margin in TasksScreen.css), for folding and growing. */
const ROW_GAP = '10px'

/**
 * One task: what and how much, where it lives, its status, and its note if it has one. The whole
 * card opens the purchase (the open button stretches over it); only the status button sits above.
 */
function TaskRow({ task, rowRef, entering, onEntered, onOpen, onStatus }: RowProps) {
  const { txn, pile, statement, overdue } = task
  const flag = txn.status === 'flagged'
  const ref = useRef<HTMLLIElement | null>(null)
  const animate = useAnimate()

  // Arriving from another group: the mirror of folding away. It grows from nothing while fading in.
  // A layout effect, so it starts before the row is first painted at full size.
  useLayoutEffect(() => {
    const el = ref.current
    if (!entering || !el) return
    void animate(
      el,
      [
        { opacity: 0, height: '0px', marginBottom: '0px' },
        { opacity: 1, height: `${el.offsetHeight}px`, marginBottom: ROW_GAP },
      ],
      { duration: DURATION.move, easing: EASE_OUT },
      [{ opacity: 0 }, { opacity: 1 }],
    ).then(onEntered)
    // Only when the row first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <li
      ref={(el) => {
        ref.current = el
        rowRef(el)
      }}
      className="panel task-row"
    >
      <button type="button" className="task-open" onClick={onOpen}>
        <span className="task-top">
          <span className="task-desc">{txn.desc}</span>
          <span className={`task-amount num${isOpenFlag(txn) ? ' tone-flag' : ''}`}>${usd(txn.amount)}</span>
        </span>
        <span className="task-meta">
          {pile && (
            <span className="task-where">
              <Folder size={14} aria-hidden /> {pile.name}
            </span>
          )}
          {flag && (
            <span className="task-where task-where--flag">
              <ShieldAlert size={14} aria-hidden /> Possible fraud
            </span>
          )}
          <span>{statement.name}</span>
        </span>
      </button>
      {txn.note && <p className="task-note-preview">{txn.note}</p>}
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
