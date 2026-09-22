import { RotateCcw, Upload } from 'lucide-react'
import './Header.css'

interface Props {
  title: string
  canUndo: boolean
  onUndo: () => void
  importActive: boolean
  onImport: () => void
}

export function Header({ title, canUndo, onUndo, importActive, onImport }: Props) {
  return (
    <header className="header">
      <button type="button" className="icon-btn" onClick={onUndo} disabled={!canUndo} aria-label="Undo last action">
        <RotateCcw size={18} />
      </button>
      <div className="header-title">
        <span className="header-eyebrow">Statement</span>
        <h1 className="header-name">{title}</h1>
      </div>
      <button
        type="button"
        className={`icon-btn${importActive ? ' icon-btn--active' : ''}`}
        onClick={onImport}
        aria-label="Import a statement"
        aria-pressed={importActive}
      >
        <Upload size={18} />
      </button>
    </header>
  )
}
