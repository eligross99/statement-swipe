import { useRef, useState } from 'react'
import './App.css'
import { Deck, type Direction, type LeavingCard, type Offset, type ReturningCard } from './components/Deck'
import { FolderDetail } from './components/FolderDetail'
import { FolderSheet } from './components/FolderSheet'
import { Header, type HeaderButton } from './components/Header'
import { ImportScreen, type Naming } from './components/ImportScreen'
import { InvestigateView } from './components/InvestigateView'
import { SettingsScreen } from './components/SettingsScreen'
import { StatementsScreen } from './components/StatementsScreen'
import { Summary } from './components/Summary'
import { TabBar } from './components/TabBar'
import { TasksScreen } from './components/TasksScreen'
import { useLibrary } from './hooks/useLibrary'
import { useNow } from './hooks/useNow'
import { makeId } from './lib/format'
import { openStatement, type LibraryAction, type Tab } from './lib/library'
import { DURATION, pause, screenEnter, type Enter, type Place } from './lib/motion'
import { currentTxn, type ReviewEvent } from './lib/review'
import { defaultName, pastFolderNames, statementPeriod, uniqueName } from './lib/statements'
import { allTasks, overdueCount, type Task } from './lib/tasks'
import type { Screen, Session, Status, Transaction } from './types'

const CENTER: Offset = { x: 0, y: 0 }
/** Where the top card rests while Look closer is open (leaning left) or the folder sheet is (lifted). */
const LEAN_LEFT: Offset = { x: -26, y: 0 }
const LEAN_UP: Offset = { x: 0, y: -64 }

/** Which way a card flew off the deck, from the status it was given. */
const flewTo = (status: Status): Direction => (status === 'approved' ? 'right' : status === 'flagged' ? 'left' : 'up')

/** Stands in for the review while no statement is open, so review code never has to check. */
const NO_SESSION: Session = { txns: [], index: 0, piles: [], screen: 'deck', openPile: null }

export default function App() {
  const library = useLibrary()
  const { statements, view, home, filter, settings, ready, dispatch: send } = library
  const statement = openStatement(library)
  const session = statement?.session ?? NO_SESSION
  const history = statement?.history ?? []
  /** Changes the open statement's review. */
  const dispatch = (event: ReviewEvent) => send({ type: 'review', event })
  // Screen-level UI state that isn't part of the saved session.
  const [investigatingId, setInvestigatingId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [leaving, setLeaving] = useState<LeavingCard | null>(null)
  const [returning, setReturning] = useState<ReturningCard | null>(null)
  const [lean, setLean] = useState<Offset | null>(null)
  // True during the short pause after Look closer closes, before the card flies.
  const [busy, setBusy] = useState(false)
  // Bumped by every jump, so a delayed step from before the jump knows to stop.
  const generation = useRef(0)
  // The purchase a folder was opened for from Tasks: highlighted there, and Back returns to Tasks.
  const [taskFocus, setTaskFocus] = useState<string | null>(null)
  const now = useNow()
  const overdue = overdueCount(allTasks(statements, now, settings.remindAfterDays))

  const current = currentTxn(session)
  const investigating = session.txns.find((t) => t.id === investigatingId) ?? null

  // Keep showing the deck until the last card has flown off; then the summary rises in.
  const screen: Screen = session.screen === 'summary' && leaving ? 'deck' : session.screen
  const place: Place = statement ? screen : view === 'review' ? home : view
  // How the current screen entered. Worked out while rendering, from the screen shown before.
  const [shown, setShown] = useState<{ place: Place | null; enter: Enter }>({ place: null, enter: 'fade' })
  if (ready && shown.place !== place) {
    setShown({ place, enter: shown.place ? screenEnter(shown.place, place) : 'fade' })
  }

  /** Resolves the top card and sends a copy of it flying off in `dir`. */
  const resolve = (event: ReviewEvent, dir: Direction, from: Offset = CENTER) => {
    if (!current) return
    setLeaving({ txn: current, dir, from })
    setLean(null)
    setReturning(null)
    dispatch(event)
  }

  /** After Look closer slides away: a beat showing the same card, then it flies. */
  const decideAfterLook = async (event: ReviewEvent, dir: Direction) => {
    const gen = generation.current
    setInvestigatingId(null)
    setBusy(true)
    await pause(DURATION.pause)
    if (gen !== generation.current) return
    setBusy(false)
    resolve(event, dir, LEAN_LEFT)
  }

  /** Drops overlays and any moving card, before jumping somewhere (undo, restart, another screen). */
  const settle = () => {
    generation.current++
    setInvestigatingId(null)
    setSheetOpen(false)
    setLeaving(null)
    setReturning(null)
    setLean(null)
    setBusy(false)
    setTaskFocus(null)
  }

  const jump = (event: ReviewEvent) => {
    settle()
    dispatch(event)
  }

  /** Moves between the app's places (Statements, Tasks, a review, import, settings). */
  const go = (event: LibraryAction) => {
    settle()
    send(event)
  }

  /** Saves newly imported purchases as a statement and opens it. */
  const addStatement = (txns: Transaction[], naming: Naming) => {
    const taken = statements.map((st) => st.name)
    const period = statementPeriod(txns, 'closing' in naming ? naming.closing : null)
    const name = 'name' in naming ? uniqueName(naming.name, taken) : defaultName(period, naming.fallback, taken)
    go({ type: 'add', id: makeId('st'), txns, name, period })
  }

  const undo = () => {
    const last = history[history.length - 1]
    const txn = last && session.txns.find((t) => t.id === last.txnId)
    jump({ type: 'undo' })
    if (txn) setReturning({ txnId: txn.id, dir: flewTo(txn.status) })
  }

  const goTab = (tab: Tab) => go({ type: 'go', view: tab })
  /** Back to the tab the user came from. */
  const back: HeaderButton = {
    kind: 'back',
    label: home === 'tasks' ? 'Back to tasks' : 'Back to statements',
    onClick: () => goTab(home),
  }
  const settingsButton: HeaderButton = { kind: 'settings', onClick: () => go({ type: 'go', view: 'settings' }) }

  /** A change to a task's purchase, in whichever statement it belongs to. */
  const changeTask = (task: Task, event: ReviewEvent) => send({ type: 'review', id: task.statement.id, event })

  let header: { title: string; left: HeaderButton; right: HeaderButton }
  if (place === 'statements') {
    header = { title: 'Statements', left: null, right: settingsButton }
  } else if (place === 'tasks') {
    header = { title: 'Tasks', left: null, right: settingsButton }
  } else if (place === 'import') {
    header = { title: 'New statement', left: back, right: null }
  } else if (place === 'settings') {
    header = { title: 'Settings', left: back, right: null }
  } else if (place === 'pile') {
    header = {
      title: session.piles.find((pl) => pl.id === session.openPile)?.name ?? '',
      // Opened from Tasks: straight back there. Otherwise back to the statement's summary.
      left: taskFocus
        ? back
        : { kind: 'back', label: 'Back to all folders', onClick: () => dispatch({ type: 'closePile' }) },
      right: null,
    }
  } else {
    header = {
      title: statement?.name ?? '',
      left: back,
      right: { kind: 'undo', enabled: history.length > 0, onClick: undo },
    }
  }

  return (
    <div className="app">
      <Header {...header} />

      {!ready ? (
        <p className="app-loading">Loading…</p>
      ) : (
        // Keyed by screen, so each new screen mounts fresh and plays its entrance.
        <div key={place} className={`view enter-${shown.enter}`}>
          {place === 'statements' && (
            <StatementsScreen
              statements={statements}
              filter={filter}
              onFilter={(f) => send({ type: 'setFilter', filter: f })}
              onOpen={(id) => go({ type: 'open', id })}
              onImport={() => go({ type: 'go', view: 'import' })}
              onRename={(id, name) => send({ type: 'rename', id, name })}
              onArchive={(id, archived) => send({ type: 'archive', id, archived })}
              onDelete={(id) => send({ type: 'delete', id })}
            />
          )}

          {place === 'tasks' && (
            <TasksScreen
              statements={statements}
              now={now}
              remindAfterDays={settings.remindAfterDays}
              onOpenFolder={(task) => {
                if (!task.pile) return
                go({ type: 'openFolder', id: task.statement.id, pileId: task.pile.id })
                setTaskFocus(task.txn.id)
              }}
              onSetAction={(task, action) => changeTask(task, { type: 'setAction', txnId: task.txn.id, action })}
              onSetNote={(task, note) => changeTask(task, { type: 'setNote', txnId: task.txn.id, note })}
              onRecognize={(task) => changeTask(task, { type: 'approveFlagged', txnId: task.txn.id })}
            />
          )}

          {place === 'import' && <ImportScreen onStart={addStatement} />}

          {place === 'settings' && (
            <SettingsScreen
              statementCount={statements.length}
              settings={settings}
              onChange={(change) => send({ type: 'setSettings', settings: change })}
              onEraseAll={() => send({ type: 'eraseAll' })}
            />
          )}

          {place === 'deck' && (
            <Deck
              txns={session.txns}
              index={session.index}
              paused={investigating !== null || sheetOpen || busy}
              lean={lean}
              leaving={leaving}
              returning={returning}
              onLeaveDone={() => setLeaving(null)}
              onApprove={(from) => resolve({ type: 'approve' }, 'right', from)}
              onInvestigate={() => {
                if (!current) return
                setLean(LEAN_LEFT)
                setInvestigatingId(current.id)
              }}
              onFile={() => {
                setLean(LEAN_UP)
                setSheetOpen(true)
              }}
            />
          )}

          {place === 'summary' && (
            <Summary
              txns={session.txns}
              piles={session.piles}
              onInspect={(t) => setInvestigatingId(t.id)}
              onOpenPile={(pileId) => dispatch({ type: 'openPile', pileId })}
              onRestart={() => jump({ type: 'restart' })}
            />
          )}

          {place === 'pile' && (
            <FolderDetail
              pile={session.piles.find((p) => p.id === session.openPile) ?? null}
              txns={session.txns}
              onSetAction={(txnId, action) => dispatch({ type: 'setAction', txnId, action })}
              onSetNote={(txnId, note) => dispatch({ type: 'setNote', txnId, note })}
              focusId={taskFocus}
            />
          )}
        </div>
      )}

      {ready && (place === 'statements' || place === 'tasks') && (
        <TabBar tab={place} overdue={overdue} onGo={goTab} />
      )}

      {investigating && (
        <InvestigateView
          txn={investigating}
          // Approve/flag only make sense for the card on top of the deck, not from the summary.
          canDecide={current?.id === investigating.id}
          onBack={() => {
            setInvestigatingId(null)
            setLean(null)
          }}
          onApprove={() => void decideAfterLook({ type: 'approve' }, 'right')}
          onFlag={() => void decideAfterLook({ type: 'flag' }, 'left')}
          onRecognize={() => {
            setInvestigatingId(null)
            dispatch({ type: 'approveFlagged', txnId: investigating.id })
          }}
          onSetAction={(action) => dispatch({ type: 'setAction', txnId: investigating.id, action })}
          onSetNote={(note) => dispatch({ type: 'setNote', txnId: investigating.id, note })}
        />
      )}

      {sheetOpen && (
        <FolderSheet
          piles={session.piles}
          txns={session.txns}
          suggestions={statement && settings.suggestFolders ? pastFolderNames(statements, statement) : []}
          onClose={() => {
            setSheetOpen(false)
            setLean(null)
          }}
          onFile={(pileId) => {
            setSheetOpen(false)
            resolve({ type: 'file', pileId }, 'up', LEAN_UP)
          }}
          onCreate={(name) => {
            setSheetOpen(false)
            resolve({ type: 'createPileAndFile', pile: { id: makeId('f'), name } }, 'up', LEAN_UP)
          }}
          onDelete={(pileId) => dispatch({ type: 'deletePile', pileId })}
        />
      )}
    </div>
  )
}
