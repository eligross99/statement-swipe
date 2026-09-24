import type { ReactNode } from 'react'
import { Sheet } from './Sheet'

interface Props {
  id: string
  title: string
  children: ReactNode
  /** The red button's label: says exactly what happens, e.g. "Delete statement". */
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

/** Asks before something that can't be undone. Cancel is focused first, so Enter never destroys. */
export function ConfirmSheet({ id, title, children, confirmLabel, onConfirm, onCancel }: Props) {
  return (
    <Sheet id={id} title={title} onDismiss={onCancel}>
      {(close) => (
        <>
          <p className="sheet-text">{children}</p>
          <div className="btn-row">
            <button type="button" className="btn btn--secondary" onClick={() => close()} autoFocus>
              Cancel
            </button>
            <button type="button" className="btn btn--flag" onClick={() => close(onConfirm)}>
              {confirmLabel}
            </button>
          </div>
        </>
      )}
    </Sheet>
  )
}
