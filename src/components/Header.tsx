import { ChevronLeft, Pencil, RotateCcw, Settings } from 'lucide-react'
import './Header.css'

/** A round icon button in a header corner. */
export type HeaderButton =
  | { kind: 'back'; label: string; onClick: () => void }
  | { kind: 'undo'; enabled: boolean; onClick: () => void }
  | { kind: 'settings'; onClick: () => void }
  | null

interface Props {
  title: string
  /** When given, tapping the title renames what it names (e.g. the open statement). */
  onRename?: () => void
  left: HeaderButton
  right: HeaderButton
}

export function Header({ title, onRename, left, right }: Props) {
  return (
    <header className="header">
      <Corner button={left} />
      <h1 className="header-name">
        {onRename ? (
          <button type="button" className="header-title-btn" onClick={onRename} aria-describedby="header-rename-hint">
            <span className="header-title-text">{title}</span>
            <Pencil size={14} className="header-title-icon" aria-hidden />
          </button>
        ) : (
          title
        )}
      </h1>
      {onRename && (
        <span id="header-rename-hint" className="visually-hidden">
          Tap to rename
        </span>
      )}
      <Corner button={right} />
    </header>
  )
}

function Corner({ button }: { button: HeaderButton }) {
  // Always a slot on each side, so the title stays centered.
  if (!button) return <span className="header-spacer" aria-hidden />
  switch (button.kind) {
    case 'back':
      return (
        <button type="button" className="icon-btn" onClick={button.onClick} aria-label={button.label}>
          <ChevronLeft size={22} />
        </button>
      )
    case 'undo':
      return (
        <button
          type="button"
          className="icon-btn"
          onClick={button.onClick}
          disabled={!button.enabled}
          aria-label="Undo last action"
        >
          <RotateCcw size={18} />
        </button>
      )
    case 'settings':
      return (
        <button type="button" className="icon-btn" onClick={button.onClick} aria-label="Settings" title="Settings">
          <Settings size={19} />
        </button>
      )
  }
}
