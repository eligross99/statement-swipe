import { useState } from 'react'
import { Sheet } from './Sheet'

interface Props {
  name: string
  onRename: (name: string) => void
  onClose: () => void
}

/** Longest statement name, e.g. "September 2026 Bank of America Credit Card Statement" fits. */
const MAX_NAME = 80

/** Bottom sheet for renaming a statement. */
export function RenameSheet({ name, onRename, onClose }: Props) {
  const [value, setValue] = useState(name)
  const trimmed = value.trim()
  const canSave = !!trimmed && trimmed !== name

  return (
    <Sheet id="rename-title" title="Rename statement" onDismiss={onClose}>
      {(close) => (
        <form
          className="rename-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (canSave) close(() => onRename(trimmed))
          }}
        >
          <input
            className="text-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Statement name"
            maxLength={MAX_NAME}
            enterKeyHint="done"
            autoFocus
          />
          <button type="submit" className="btn btn--primary" disabled={!canSave}>
            Save name
          </button>
        </form>
      )}
    </Sheet>
  )
}
