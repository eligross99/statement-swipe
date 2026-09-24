import { ChevronLeft, FilePlus2, RotateCcw } from 'lucide-react'
import './Header.css'

/** The top-left button: undo while reviewing, or "back" on screens that have a parent. */
export type HeaderLeft =
  | { kind: 'undo'; enabled: boolean; onClick: () => void }
  | { kind: 'back'; label: string; onClick: () => void }
  | null

interface Props {
  title: string
  left: HeaderLeft
  /** Opens the import screen. Hidden (null) while already there. */
  onNew: (() => void) | null
}

export function Header({ title, left, onNew }: Props) {
  return (
    <header className="header">
      {left?.kind === 'undo' && (
        <button
          type="button"
          className="icon-btn"
          onClick={left.onClick}
          disabled={!left.enabled}
          aria-label="Undo last action"
        >
          <RotateCcw size={18} />
        </button>
      )}
      {left?.kind === 'back' && (
        <button type="button" className="icon-btn" onClick={left.onClick} aria-label={left.label}>
          <ChevronLeft size={22} />
        </button>
      )}
      {/* Always a slot on each side, so the title stays centered. */}
      {!left && <span className="header-spacer" aria-hidden />}
      <h1 className="header-name">{title}</h1>
      {onNew ? (
        <button type="button" className="icon-btn" onClick={onNew} aria-label="New statement" title="New statement">
          <FilePlus2 size={19} />
        </button>
      ) : (
        <span className="header-spacer" aria-hidden />
      )}
    </header>
  )
}
