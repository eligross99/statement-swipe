import { ChevronDown, Pencil } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { ACTION_LABELS } from '../lib/review'
import type { Action, Transaction } from '../types'
import './TaskControls.css'

/** The button showing a purchase's status (To do, Waiting, Done); tapping it opens the status menu. */
export function StatusPill({ txn, onClick }: { txn: Transaction; onClick: () => void }) {
  const label = txn.action ? ACTION_LABELS[txn.action] : 'Set status'
  return (
    <button
      type="button"
      className={`status-pill${txn.action ? ` status-pill--${txn.action}` : ''}`}
      onClick={onClick}
      aria-haspopup="dialog"
      aria-label={`Status: ${txn.action ? label : 'not set'}. Change status for ${txn.desc}`}
    >
      <span className="status-dot" aria-hidden />
      {label}
      <ChevronDown size={16} aria-hidden />
    </button>
  )
}

/** A small, non-tappable label for a status, for lists that only show it. */
export function StatusTag({ action }: { action: Exclude<Action, null> }) {
  return (
    <span className={`status-tag status-tag--${action}`}>
      <span className="status-dot" aria-hidden />
      {ACTION_LABELS[action]}
    </span>
  )
}

interface Props {
  txn: Transaction
  noteOpen: boolean
  onNoteOpen: (open: boolean) => void
  onStatus: () => void
  onSetNote: (note: string) => void
}

/** A task's status button and note: shown on folder items and on flagged purchases in Look closer. */
export function TaskControls({ txn, noteOpen, onNoteOpen, onStatus, onSetNote }: Props) {
  return (
    <>
      <div className="task-controls">
        <StatusPill txn={txn} onClick={onStatus} />
        {!noteOpen && (
          <button type="button" className={`note-pill${txn.note ? ' has-note' : ''}`} onClick={() => onNoteOpen(true)}>
            <Pencil size={14} /> {txn.note ? 'Edit note' : 'Add note'}
          </button>
        )}
      </div>

      {noteOpen ? (
        <NoteEditor
          value={txn.note}
          label={`Note for ${txn.desc}`}
          placeholder={
            txn.status === 'flagged'
              ? 'e.g. called the bank, claim number 4471'
              : 'e.g. ask the ski trip group to Venmo their share'
          }
          onChange={onSetNote}
          onDone={() => {
            // Tidy stray spaces/blank lines so an "empty" note really is empty.
            if (txn.note.trim() !== txn.note) onSetNote(txn.note.trim())
            onNoteOpen(false)
          }}
        />
      ) : (
        txn.note && (
          <button type="button" className="task-note" onClick={() => onNoteOpen(true)} aria-label={`Edit note: ${txn.note}`}>
            {txn.note}
          </button>
        )
      )}
    </>
  )
}

interface NoteEditorProps {
  value: string
  label: string
  placeholder: string
  onChange: (note: string) => void
  onDone: () => void
}

/** Sets a textarea's height to fit its text, so the whole note is always visible while typing. */
function fitHeight(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  // scrollHeight leaves out the borders; add them back or a scrollbar appears.
  el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`
}

/** A note field that grows with its text and opens with the cursor at the end. */
function NoteEditor({ value, label, placeholder, onChange, onDone }: NoteEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  // Once, when the editor opens: focus it, put the cursor after the existing text, and size it.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
    fitHeight(el)
  }, [])

  return (
    <div className="note-edit">
      <textarea
        ref={ref}
        className="text-input note-textarea"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          fitHeight(e.target)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            onDone()
          }
        }}
        rows={2}
        maxLength={500}
        aria-label={label}
        placeholder={placeholder}
      />
      <button type="button" className="btn btn--pile btn--auto note-done" onClick={onDone}>
        Save
      </button>
    </div>
  )
}
