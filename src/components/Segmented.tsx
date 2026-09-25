import type { CSSProperties } from 'react'
import './Segmented.css'

interface Props<T extends string> {
  /** What the choice is about, for screen readers (e.g. "Show statements"). */
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  className?: string
}

/**
 * A row of equal choices on a white track, with a mint pill that slides to the chosen one, like the
 * tab bar's. Used by the Statements filters and Settings' Appearance.
 */
export function Segmented<T extends string>({ label, options, value, onChange, className }: Props<T>) {
  const index = options.findIndex((o) => o.value === value)
  return (
    <div
      className={`segmented${className ? ` ${className}` : ''}`}
      role="group"
      aria-label={label}
      style={{ '--count': options.length } as CSSProperties}
    >
      <span
        className="segmented-pill"
        style={{ transform: `translateX(calc(${index} * (100% + 4px)))` }}
        aria-hidden
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`segmented-option${o.value === value ? ' is-on' : ''}`}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
