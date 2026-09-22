import { useState } from 'react'
import './App.css'
import { Deck, type LeavingCard, type Offset } from './components/Deck'
import { FolderDetail } from './components/FolderDetail'
import { FolderSheet } from './components/FolderSheet'
import { Header } from './components/Header'
import { ImportScreen } from './components/ImportScreen'
import { InvestigateView } from './components/InvestigateView'
import { Summary } from './components/Summary'
import { useReview } from './hooks/useReview'
import { makeId } from './lib/format'
import { currentTxn, type ReviewEvent } from './lib/review'

const CENTER: Offset = { x: 0, y: 0 }

export default function App() {
  const { session, history, ready, dispatch } = useReview()
  // Screen-level UI state that isn't part of the saved session.
  const [investigatingId, setInvestigatingId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [leaving, setLeaving] = useState<LeavingCard | null>(null)

  const current = currentTxn(session)
  const investigating = session.txns.find((t) => t.id === investigatingId) ?? null

  /** Resolves the top card and sends a copy of it flying off in `dir`. */
  const resolve = (event: ReviewEvent, dir: LeavingCard['dir'], from: Offset = CENTER) => {
    if (!current) return
    setLeaving({ txn: current, dir, from })
    dispatch(event)
  }

  /** For events that jump around (undo, restart, new import): drop overlays and any flying card. */
  const jump = (event: ReviewEvent) => {
    setInvestigatingId(null)
    setSheetOpen(false)
    setLeaving(null)
    dispatch(event)
  }

  const canUndo = history.length > 0 && (session.screen === 'deck' || session.screen === 'summary')

  return (
    <div className="app">
      <Header
        title={session.screen === 'import' ? 'New import' : session.label}
        canUndo={canUndo}
        onUndo={() => jump({ type: 'undo' })}
        importActive={session.screen === 'import'}
        onImport={() => jump({ type: 'goImport' })}
      />

      {!ready ? (
        <p className="app-loading">Loading…</p>
      ) : (
        <>
          {session.screen === 'import' && (
            <ImportScreen
              resumeLabel={session.txns.length ? session.label : null}
              onResume={() => dispatch({ type: 'resume' })}
              onStart={(txns, label) => jump({ type: 'start', txns, label })}
            />
          )}

          {session.screen === 'deck' && (
            <Deck
              txns={session.txns}
              index={session.index}
              paused={investigating !== null || sheetOpen}
              leaving={leaving}
              onLeaveDone={() => setLeaving(null)}
              onApprove={(from) => resolve({ type: 'approve' }, 'right', from)}
              onInvestigate={() => current && setInvestigatingId(current.id)}
              onFile={() => setSheetOpen(true)}
            />
          )}

          {session.screen === 'summary' && (
            <Summary
              txns={session.txns}
              piles={session.piles}
              onInspect={(t) => setInvestigatingId(t.id)}
              onOpenPile={(pileId) => dispatch({ type: 'openPile', pileId })}
              onRestart={() => jump({ type: 'restart' })}
              onNew={() => jump({ type: 'goImport' })}
            />
          )}

          {session.screen === 'pile' && (
            <FolderDetail
              pile={session.piles.find((p) => p.id === session.openPile) ?? null}
              txns={session.txns}
              onBack={() => dispatch({ type: 'closePile' })}
              onSetAction={(txnId, action) => dispatch({ type: 'setAction', txnId, action })}
              onSetNote={(txnId, note) => dispatch({ type: 'setNote', txnId, note })}
            />
          )}
        </>
      )}

      {investigating && (
        <InvestigateView
          txn={investigating}
          // Approve/flag only make sense for the card on top of the deck, not from the summary.
          canDecide={current?.id === investigating.id}
          onBack={() => setInvestigatingId(null)}
          onApprove={() => {
            setInvestigatingId(null)
            resolve({ type: 'approve' }, 'right')
          }}
          onFlag={() => {
            setInvestigatingId(null)
            resolve({ type: 'flag' }, 'left')
          }}
        />
      )}

      {sheetOpen && (
        <FolderSheet
          piles={session.piles}
          txns={session.txns}
          onClose={() => setSheetOpen(false)}
          onFile={(pileId) => {
            setSheetOpen(false)
            resolve({ type: 'file', pileId }, 'up')
          }}
          onCreate={(name) => {
            setSheetOpen(false)
            resolve({ type: 'createPileAndFile', pile: { id: makeId('f'), name } }, 'up')
          }}
          onDelete={(pileId) => dispatch({ type: 'deletePile', pileId })}
        />
      )}
    </div>
  )
}
