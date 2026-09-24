import { useRef, useState } from 'react'
import './App.css'
import { Deck, type Direction, type LeavingCard, type Offset, type ReturningCard } from './components/Deck'
import { FolderDetail } from './components/FolderDetail'
import { FolderSheet } from './components/FolderSheet'
import { Header, type HeaderLeft } from './components/Header'
import { ImportScreen } from './components/ImportScreen'
import { InvestigateView } from './components/InvestigateView'
import { Summary } from './components/Summary'
import { useReview } from './hooks/useReview'
import { makeId } from './lib/format'
import { DURATION, pause, screenEnter, type Enter } from './lib/motion'
import { currentTxn, reviewedCount, type ReviewEvent } from './lib/review'
import type { Screen, Status } from './types'

const CENTER: Offset = { x: 0, y: 0 }
/** Where the top card rests while Look closer is open (leaning left) or the folder sheet is (lifted). */
const LEAN_LEFT: Offset = { x: -26, y: 0 }
const LEAN_UP: Offset = { x: 0, y: -64 }

/** Which way a card flew off the deck, from the status it was given. */
const flewTo = (status: Status): Direction => (status === 'approved' ? 'right' : status === 'flagged' ? 'left' : 'up')

export default function App() {
  const { session, history, ready, dispatch } = useReview()
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

  const current = currentTxn(session)
  const investigating = session.txns.find((t) => t.id === investigatingId) ?? null

  // Keep showing the deck until the last card has flown off; then the summary rises in.
  const screen: Screen = session.screen === 'summary' && leaving ? 'deck' : session.screen
  // How the current screen entered. Worked out while rendering, from the screen shown before.
  const [shown, setShown] = useState<{ screen: Screen | null; enter: Enter }>({ screen: null, enter: 'fade' })
  if (ready && shown.screen !== screen) {
    setShown({ screen, enter: shown.screen ? screenEnter(shown.screen, screen) : 'fade' })
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

  /** For events that jump around (undo, restart, new import): drop overlays and any moving card. */
  const jump = (event: ReviewEvent) => {
    generation.current++
    setInvestigatingId(null)
    setSheetOpen(false)
    setLeaving(null)
    setReturning(null)
    setLean(null)
    setBusy(false)
    dispatch(event)
  }

  const undo = () => {
    const last = history[history.length - 1]
    const txn = last && session.txns.find((t) => t.id === last.txnId)
    jump({ type: 'undo' })
    if (txn) setReturning({ txnId: txn.id, dir: flewTo(txn.status) })
  }

  const goImport = () => jump({ type: 'goImport' })

  let left: HeaderLeft
  if (session.screen === 'import') {
    left = session.txns.length ? { kind: 'back', label: 'Back to your review', onClick: () => dispatch({ type: 'resume' }) } : null
  } else if (session.screen === 'pile') {
    left = { kind: 'back', label: 'Back to all folders', onClick: () => dispatch({ type: 'closePile' }) }
  } else {
    left = { kind: 'undo', enabled: history.length > 0, onClick: undo }
  }

  return (
    <div className="app">
      <Header
        title={
          session.screen === 'import'
            ? 'New statement'
            : session.screen === 'pile'
              ? (session.piles.find((pl) => pl.id === session.openPile)?.name ?? session.label)
              : session.label
        }
        left={left}
        onNew={session.screen === 'import' ? null : goImport}
      />

      {!ready ? (
        <p className="app-loading">Loading…</p>
      ) : (
        // Keyed by screen, so each new screen mounts fresh and plays its entrance.
        <div key={screen} className={`view enter-${shown.enter}`}>
          {screen === 'import' && (
            <ImportScreen
              current={
                session.txns.length
                  ? { label: session.label, reviewed: reviewedCount(session.txns), total: session.txns.length }
                  : null
              }
              onResume={() => dispatch({ type: 'resume' })}
              onStart={(txns, label) => jump({ type: 'start', txns, label })}
            />
          )}

          {screen === 'deck' && (
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

          {screen === 'summary' && (
            <Summary
              txns={session.txns}
              piles={session.piles}
              onInspect={(t) => setInvestigatingId(t.id)}
              onOpenPile={(pileId) => dispatch({ type: 'openPile', pileId })}
              onRestart={() => jump({ type: 'restart' })}
            />
          )}

          {screen === 'pile' && (
            <FolderDetail
              pile={session.piles.find((p) => p.id === session.openPile) ?? null}
              txns={session.txns}
              onSetAction={(txnId, action) => dispatch({ type: 'setAction', txnId, action })}
              onSetNote={(txnId, note) => dispatch({ type: 'setNote', txnId, note })}
            />
          )}
        </div>
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
        />
      )}

      {sheetOpen && (
        <FolderSheet
          piles={session.piles}
          txns={session.txns}
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
