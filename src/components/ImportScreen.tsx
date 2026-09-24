import { FileText, Sparkles, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useAnimate } from '../hooks/useAnimate'
import { parseGrid, type ColumnMap, type Grid } from '../lib/csv'
import { formatDate } from '../lib/dates'
import { plural, usd } from '../lib/format'
import { token } from '../lib/motion'
import { SAMPLE_LABEL, sampleTransactions } from '../lib/sample'
import { CSVSource, guessSettings, type CsvSettings } from '../sources/csvSource'
import type { Transaction } from '../types'
import { Sheet } from './Sheet'
import './ImportScreen.css'

/** The review already on this device, which a new statement would replace. */
export interface CurrentReview {
  label: string
  reviewed: number
  total: number
}

interface Props {
  /** The saved review the user can go back to, if any. */
  current: CurrentReview | null
  onStart: (txns: Transaction[], label: string) => void
}

interface PendingStart {
  txns: Transaction[]
  label: string
}

interface Parsed {
  fileName: string
  grid: Grid
}

/** How many of the file's first lines the header-row picker offers. */
const HEADER_CHOICES = 15

export function ImportScreen({ current, onStart }: Props) {
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [settings, setSettings] = useState<CsvSettings | null>(null)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  // A new statement waiting for the user to confirm it may replace their review.
  const [pending, setPending] = useState<PendingStart | null>(null)
  // True after removing a chosen file, so the file picker slides back in from the left.
  const [cameBack, setCameBack] = useState(false)
  const mapping = useRef<HTMLDivElement>(null)
  const animate = useAnimate()

  /** Starts right away, unless that would replace a review the user has made decisions in. */
  const start = (txns: Transaction[], label: string) => {
    if (current && current.reviewed > 0) setPending({ txns, label })
    else onStart(txns, label)
  }

  /** Briefly highlights a field the user just changed, so the change is easy to see. */
  const flash = (el: HTMLElement) => {
    const rest = getComputedStyle(el)
    const from = { backgroundColor: token('--brand-tint'), borderColor: token('--brand') }
    void animate(el, [from, { backgroundColor: rest.backgroundColor, borderColor: rest.borderColor }], {
      duration: 700,
    })
  }

  const confirmSheet = pending && current && (
    <Sheet id="replace-title" title="Replace your review?" onDismiss={() => setPending(null)}>
      {(close) => (
        <>
          <p className="import-confirm-text">
            {current.reviewed < current.total
              ? `You’ve reviewed ${current.reviewed} of ${plural(current.total, 'purchase')} in “${current.label}”. `
              : `Your review of “${current.label}” is finished. `}
            Starting a new statement clears it, including its folders and notes.
          </p>
          <div className="btn-row">
            <button type="button" className="btn btn--secondary" onClick={() => close()} autoFocus>
              Keep my review
            </button>
            <button
              type="button"
              className="btn btn--flag"
              onClick={() => close(() => onStart(pending.txns, pending.label))}
            >
              Replace it
            </button>
          </div>
        </>
      )}
    </Sheet>
  )

  const source = useMemo(() => (parsed && settings ? new CSVSource(parsed.grid, settings) : null), [parsed, settings])
  const purchases = useMemo(() => source?.purchases() ?? [], [source])
  const total = purchases.reduce((s, p) => s + p.amount, 0)

  // Parsing happens entirely in the browser; the file is never uploaded anywhere.
  const readFile = async (file: File) => {
    setError('')
    let grid: Grid
    try {
      grid = parseGrid(await file.text())
    } catch {
      setError("Couldn't read that file. Make sure it's a CSV export from your bank.")
      return
    }
    if (!grid.length) {
      setError('That file looked empty.')
      return
    }
    setParsed({ fileName: file.name, grid })
    setSettings(guessSettings(grid))
  }

  if (!parsed) {
    return (
      <div className={`screen${cameBack ? ' enter-pop' : ''}`} key="choose">
        {/* Just information: the header's back arrow is the one way back to the review. */}
        {current && <p className="import-current">Your review of “{current.label}” is saved.</p>}

        <h2 className="screen-title">Import your statement</h2>
        <p className="muted import-lede">
          Download a CSV from your bank or card site, then add it here. It never leaves this device.
        </p>

        <label
          className={`dropzone${dragOver ? ' is-over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            const f = e.dataTransfer.files?.[0]
            if (f) readFile(f)
          }}
        >
          <span className="dropzone-icon">
            <FileText size={24} />
          </span>
          <span className="dropzone-title">Choose a CSV file</span>
          <span className="dropzone-sub">or drag it here</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="visually-hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) readFile(f)
              e.target.value = ''
            }}
          />
        </label>

        {error && (
          <p className="import-error" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          className="btn btn--secondary import-sample"
          onClick={() => start(sampleTransactions(), SAMPLE_LABEL)}
        >
          <Sparkles size={16} /> Try the sample statement
        </button>
        {confirmSheet}
      </div>
    )
  }

  if (!settings || !source) return null
  const { map, negativePurchases: negative, headerRow } = settings
  const { headers, rows } = source.table
  const setMap = (next: ColumnMap) => setSettings({ ...settings, map: next })
  const ready = !!(map.desc && map.amount) && purchases.length > 0

  return (
    <div className="screen enter-push" key="map" ref={mapping}>
      <div className="import-file">
        <FileText size={16} className="tone-pile" />
        <span className="import-file-name">{parsed.fileName}</span>
        <button
          type="button"
          className="icon-btn icon-btn--flat"
          // Fade the column setup away, then go back to choosing a file.
          onClick={() =>
            void animate(mapping.current, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, hold: true }, [
              { opacity: 1 },
              { opacity: 0 },
            ]).then(() => {
              setParsed(null)
              setSettings(null)
              setCameBack(true)
            })
          }
          aria-label="Choose a different file"
        >
          <X size={18} />
        </button>
      </div>
      <p className="muted import-count">
        {plural(rows.length, 'row')} found
        {headerRow > 0 && `, after skipping ${plural(headerRow, 'intro line')}`}. Confirm the columns below.
      </p>

      <div className="panel import-map">
        <div className="map-row">
          <label htmlFor="map-header" className="map-label">
            Column names
          </label>
          <select
            id="map-header"
            className="map-select"
            value={headerRow}
            // A different header row means different columns, so re-guess everything.
            onChange={(e) => {
              setSettings(guessSettings(parsed.grid, Number(e.target.value)))
              flash(e.currentTarget)
            }}
          >
            <option value={-1}>None (no header row)</option>
            {parsed.grid.slice(0, HEADER_CHOICES).map((row, i) => (
              <option key={i} value={i}>
                Line {i + 1}: {row.filter(Boolean).join(', ')}
              </option>
            ))}
          </select>
        </div>
        <MapRow
          label="Description"
          value={map.desc}
          headers={headers}
          onChange={(desc) => setMap({ ...map, desc })}
          onChanged={flash}
        />
        <MapRow
          label="Amount"
          value={map.amount}
          headers={headers}
          onChange={(amount) => setMap({ ...map, amount })}
          onChanged={flash}
        />
        <MapRow
          label="Date"
          optional
          value={map.date}
          headers={headers}
          onChange={(date) => setMap({ ...map, date })}
          onChanged={flash}
        />
        <MapRow
          label="Category"
          optional
          value={map.category}
          headers={headers}
          onChange={(category) => setMap({ ...map, category })}
          onChanged={flash}
        />
        <button
          type="button"
          role="switch"
          aria-checked={negative}
          className="toggle-row"
          onClick={() => setSettings({ ...settings, negativePurchases: !negative })}
        >
          <span>Purchases appear as negative numbers</span>
          <span className={`toggle${negative ? ' is-on' : ''}`} aria-hidden>
            <span className="toggle-knob" />
          </span>
        </button>
      </div>

      <h3 className="section-label import-preview-label">Preview</h3>
      {/* Keyed by the settings, so the preview fades in fresh whenever a choice above changes it. */}
      {purchases.length ? (
        <div className="panel preview-list enter-fade" key={JSON.stringify(settings)}>
          {purchases.slice(0, 5).map((p, i) => (
            <div key={i} className="preview-row">
              <div className="preview-main">
                <span className="preview-desc">{p.desc}</span>
                {p.date && <span className="preview-date">{formatDate(p.date)}</span>}
              </div>
              <span className="preview-amount num">${usd(p.amount)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="import-error">
          No purchases found with these columns. Check the Amount column, or flip the negative-numbers switch above.
        </p>
      )}
      {purchases.length > 5 && <p className="muted import-more">+ {purchases.length - 5} more</p>}

      <button
        type="button"
        className="btn btn--primary import-start"
        disabled={!ready}
        onClick={async () => {
          const txns = await source.load()
          start(txns, parsed.fileName.replace(/\.[^.]+$/, ''))
        }}
      >
        Review {plural(purchases.length, 'purchase')}, <span className="num">${usd(total)}</span>
      </button>
      <p className="muted import-foot">Card payments and credits are skipped automatically.</p>
      {confirmSheet}
    </div>
  )
}

function MapRow(props: {
  label: string
  value: string
  headers: string[]
  optional?: boolean
  onChange: (v: string) => void
  onChanged: (el: HTMLSelectElement) => void
}) {
  const id = `map-${props.label.toLowerCase()}`
  return (
    <div className="map-row">
      <label htmlFor={id} className="map-label">
        {props.label}
        {props.optional && <span className="map-optional muted">optional</span>}
      </label>
      <select
        id={id}
        className="map-select"
        value={props.value}
        onChange={(e) => {
          props.onChange(e.target.value)
          props.onChanged(e.currentTarget)
        }}
      >
        <option value="">{props.optional ? 'None' : 'Choose column…'}</option>
        {props.headers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
    </div>
  )
}
