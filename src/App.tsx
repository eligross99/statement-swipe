import { useCallback, useRef, useState } from 'react'
import './App.css'
import { Deck, type Direction, type LeavingCard, type Offset, type ReturningCard } from './components/Deck'
import { FolderDetail } from './components/FolderDetail'
import { FolderSheet } from './components/FolderSheet'
import { GuidePage } from './components/GuidePage'
import { Header, type HeaderButton } from './components/Header'
import { ImportScreen, type Naming } from './components/ImportScreen'
import { InvestigateView } from './components/InvestigateView'
import { SettingsScreen } from './components/SettingsScreen'
import { StatementsScreen } from './components/StatementsScreen'
import { Summary } from './components/Summary'
import { TabBar } from './components/TabBar'
import { TasksScreen } from './components/TasksScreen'
import { TourCoach } from './components/TourCoach'
import { useLibrary } from './hooks/useLibrary'
import { useNow } from './hooks/useNow'
import { useSharedFile } from './hooks/useSharedFile'
import { useTheme } from './hooks/useTheme'
import { makeId } from './lib/format'
import { openStatement, type LibraryAction, type Tab } from './lib/library'
import { DURATION, pause, screenEnter, type Enter, type Place } from './lib/motion'
import { currentTxn, type ReviewEvent } from './lib/review'
import { PRACTICE_FOLDER, PRACTICE_ID } from './lib/sample'
import { defaultName, pastFolderNames, statementPeriod } from './lib/statements'
import { discardSharedFile } from './lib/shareTarget'
import { allTasks, overdueCount } from './lib/tasks'
import { coachFor, TOUR_SWIPE, tourStep } from './lib/tour'
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
  const { settings, ready, dispatch: sendReal } = library
  // During the tour the app shows the practice library instead, and every change goes to it.
  const practice = library.tour
  const shownLibrary = practice ?? library
  const { statements, view, home, filter } = shownLibrary
  const send = (action: LibraryAction) => sendReal(practice ? { type: 'tour', action } : action)
  const statement = openStatement(shownLibrary)
  useTheme(settings.theme, ready)
  // A statement shared from Android's Share menu skips the tour (if it's running) and opens Import.
  const openShared = useCallback(
    (action: LibraryAction) => {
      sendReal({ type: 'endTour' })
      sendReal(action)
    },
    [sendReal],
  )
  const [sharedFile, clearSharedFile] = useSharedFile(ready, openShared)
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
  // "Get your statement", the per-bank download guides, sliding over the Import screen.
  const [guideOpen, setGuideOpen] = useState(false)
  // Bumped by every jump, so a delayed step from before the jump knows to stop.
  const generation = useRef(0)
  const now = useNow()
  const overdue = overdueCount(allTasks(statements, now, settings.remindAfterDays))

  const current = currentTxn(session)
  const investigating = session.txns.find((t) => t.id === investigatingId) ?? null

  // Keep showing the deck until the last card has flown off; then the summary rises in.
  const screen: Screen = session.screen === 'summary' && leaving ? 'deck' : session.screen
  const place: Place = statement ? screen : view === 'review' ? home : view
  // Starting or leaving the tour swaps the whole app, so it fades rather than sliding.
  const mode = practice ? 'tour' : 'app'
  // How the current screen entered. Worked out while rendering, from the screen shown before.
  const [shown, setShown] = useState<{ place: Place | null; mode: string; enter: Enter }>({
    place: null,
    mode,
    enter: 'fade',
  })
  if (ready && (shown.place !== place || shown.mode !== mode)) {
    const enter = shown.place && shown.mode === mode ? screenEnter(shown.place, place) : 'fade'
    setShown({ place, mode, enter })
  }

  // The tour's step, worked out from the practice statement, and what its card says here.
  const step = practice ? tourStep(practice.statements.find((st) => st.id === PRACTICE_ID)) : null
  const coach = step && coachFor(step, { place, looking: investigating !== null, filing: sheetOpen })

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

  /** Leaves the tour without finishing it; the user is back where they were (Statements the first time). */
  const skipTour = () => {
    settle()
    sendReal({ type: 'endTour' })
  }

  /** The tour's last step: on to the Import screen, with "Get your statement" open over it. */
  const finishTour = () => {
    settle()
    sendReal({ type: 'endTour' })
    sendReal({ type: 'go', view: 'import' })
    setGuideOpen(true)
  }

  /** Saves newly imported purchases as a statement and opens it. */
  const addStatement = (txns: Transaction[], naming: Naming) => {
    const taken = statements.map((st) => st.name)
    const period = statementPeriod(txns, 'closing' in naming ? naming.closing : null)
    const name = defaultName(period, naming.fallback, taken)
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
  // No Settings during the tour: it's about the real app, and the tour is a detour from it.
  const settingsButton: HeaderButton = practice
    ? null
    : { kind: 'settings', onClick: () => go({ type: 'go', view: 'settings' }) }

  /** A change to a purchase in any statement, open or not (from Tasks). */
  const changeIn = (id: string, event: ReviewEvent) => send({ type: 'review', id, event })

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
      left: { kind: 'back', label: 'Back to all folders', onClick: () => dispatch({ type: 'closePile' }) },
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
        <div key={`${mode}-${place}`} className={`view enter-${shown.enter}`}>
          {place === 'statements' && (
            <StatementsScreen
              statements={statements}
              filter={filter}
              onFilter={(f) => send({ type: 'setFilter', filter: f })}
              onOpen={(id) => go({ type: 'open', id })}
              // In the tour, importing a real statement is where the tour was heading anyway.
              onImport={() => (practice ? finishTour() : go({ type: 'go', view: 'import' }))}
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
              onSetAction={(id, txnId, action) => changeIn(id, { type: 'setAction', txnId, action })}
              onSetNote={(id, txnId, note) => changeIn(id, { type: 'setNote', txnId, note })}
              onRecognize={(id, txnId) => changeIn(id, { type: 'approveFlagged', txnId })}
            />
          )}

          {place === 'import' && (
            <ImportScreen
              onStart={addStatement}
              shared={sharedFile}
              onTakeShared={clearSharedFile}
              onHelp={() => setGuideOpen(true)}
            />
          )}

          {place === 'settings' && (
            <SettingsScreen
              statementCount={statements.length}
              settings={settings}
              onChange={(change) => send({ type: 'setSettings', settings: change })}
              onEraseAll={() => {
                send({ type: 'eraseAll' })
                void discardSharedFile()
              }}
              onReplayTour={() => {
                settle()
                sendReal({ type: 'startTour' })
              }}
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
              haptics={settings.haptics}
              only={step ? TOUR_SWIPE[step] : undefined}
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
          suggestions={
            practice
              ? [PRACTICE_FOLDER]
              : statement && settings.suggestFolders
                ? pastFolderNames(statements, statement)
                : []
          }
          suggestionsLabel={practice ? 'Suggested' : undefined}
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

      {guideOpen && <GuidePage onBack={() => setGuideOpen(false)} />}

      {ready && coach && (
        <TourCoach
          coach={coach}
          onSkip={skipTour}
          onNext={(next) => (next === 'tasks' ? goTab('tasks') : finishTour())}
        />
      )}
    </div>
  )
}
