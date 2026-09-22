import { Check, Folder, FolderPlus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { useEscape } from '../hooks/useEscape'
import { plural } from '../lib/format'
import { pileItems } from '../lib/review'
import type { Pile, Transaction } from '../types'
import './FolderSheet.css'

interface Props {
  piles: Pile[]
  txns: Transaction[]
  onClose: () => void
  onFile: (pileId: string) => void
  onCreate: (name: string) => void
  onDelete: (pileId: string) => void
}

/** Bottom sheet for filing the current purchase: pick a folder, make a new one, or delete one. */
export function FolderSheet({ piles, txns, onClose, onFile, onCreate, onDelete }: Props) {
  const [name, setName] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  useEscape(onClose)

  const trimmed = name.trim()
  const create = () => {
    if (trimmed) onCreate(trimmed)
  }

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="folder-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="folder-sheet-head">
          <h2 id="folder-sheet-title" className="folder-sheet-title">
            File this purchase
          </h2>
          <button type="button" className="icon-btn icon-btn--flat" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <p className="muted folder-sheet-sub">Tap a folder to file it into, or make a new one.</p>

        {piles.length === 0 ? (
          <div className="folder-sheet-empty">
            <Folder size={26} />
            <p>No folders yet. Name one below and this purchase goes straight into it.</p>
          </div>
        ) : (
          <ul className="folder-list">
            {piles.map((p) => {
              const n = pileItems(txns, p.id).length
              return (
                <li key={p.id} className="folder-list-item">
                  {confirmId === p.id ? (
                    <div className="folder-confirm" role="alert">
                      <span>
                        Delete “{p.name}”? Un-files {plural(n, 'purchase')}.
                      </span>
                      <div className="folder-confirm-btns">
                        <button
                          type="button"
                          className="folder-confirm-yes"
                          onClick={() => {
                            setConfirmId(null)
                            onDelete(p.id)
                          }}
                          aria-label={`Yes, delete ${p.name}`}
                        >
                          <Check size={18} />
                        </button>
                        <button
                          type="button"
                          className="folder-confirm-no"
                          onClick={() => setConfirmId(null)}
                          aria-label="Keep folder"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button type="button" className="folder-pick" onClick={() => onFile(p.id)}>
                        <span className="folder-pick-name">
                          <Folder size={16} /> {p.name}
                        </span>
                        {n > 0 && <span className="num">{n}</span>}
                      </button>
                      <button
                        type="button"
                        className="folder-delete"
                        // Empty folders go instantly; ones with purchases ask first.
                        onClick={() => (n === 0 ? onDelete(p.id) : setConfirmId(p.id))}
                        aria-label={`Delete folder ${p.name}`}
                      >
                        <Trash2 size={17} />
                      </button>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <form
          className="folder-new"
          onSubmit={(e) => {
            e.preventDefault()
            create()
          }}
        >
          <input
            className="text-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              // Handle Enter here (and cancel the form's own submit) so it files exactly once.
              if (e.key === 'Enter') {
                e.preventDefault()
                create()
              }
            }}
            placeholder="Name a new folder…"
            aria-label="New folder name"
            maxLength={40}
            // Only pop the keyboard straight away when there's nothing to tap instead.
            autoFocus={piles.length === 0}
          />
          <button type="submit" className="btn btn--pile btn--auto" disabled={!trimmed}>
            <FolderPlus size={18} /> File
          </button>
        </form>
      </div>
    </div>
  )
}
