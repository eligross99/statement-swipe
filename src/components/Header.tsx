import { ChevronLeft, RotateCcw, Settings } from 'lucide-react'
import './Header.css'

/** A round icon button in a header corner. */
export type HeaderButton =
  | { kind: 'back'; label: string; onClick: () => void }
  | { kind: 'undo'; enabled: boolean; onClick: () => void }
  | { kind: 'settings'; onClick: () => void }
  | null

interface Props {
  title: string
  left: HeaderButton
  right: HeaderButton
}

export function Header({ title, left, right }: Props) {
  return (
    <header className="header">
      <Corner button={left} />
      <h1 className="header-name">{title}</h1>
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
