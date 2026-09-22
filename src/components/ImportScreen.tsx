import { ArrowRight, FileText, Sparkles, X } from 'lucide-react'
import Papa from 'papaparse'
import { useMemo, useState } from 'react'
import {
  detectColumns,
  detectNegativePurchases,
  headersOf,
  nonEmptyRows,
  toPurchases,
  toTransactions,
  type ColumnMap,
  type CsvRow,
} from '../lib/csv'
import { plural, usd } from '../lib/format'
import { SAMPLE_LABEL, sampleTransactions } from '../lib/sample'
import type { Transaction } from '../types'
import './ImportScreen.css'

interface Props {
  /** Label of an in-progress review the user can go back to, if any. */
  resumeLabel: string | null
  onResume: () => void
  onStart: (txns: Transaction[], label: string) => void
}

interface Parsed {
  fileName: string
  rows: CsvRow[]
  headers: string[]
}

export function ImportScreen({ resumeLabel, onResume, onStart }: Props) {
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [map, setMap] = useState<ColumnMap>({ desc: '', amount: '', date: '' })
  const [negative, setNegative] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)

  const purchases = useMemo(
    () => (parsed ? toPurchases(parsed.rows, map, negative) : []),
    [parsed, map, negative],
  )
  const total = purchases.reduce((s, p) => s + p.amount, 0)

  // Parsing happens entirely in the browser; the file is never uploaded anywhere.
  const readFile = (file: File) => {
    setError('')
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        const rows = nonEmptyRows(res.data)
        if (!rows.length) {
          setError('That file looked empty.')
          return
        }
        const headers = headersOf(rows)
        const cols = detectColumns(headers)
        setParsed({ fileName: file.name, rows, headers })
        setMap(cols)
        setNegative(detectNegativePurchases(rows, cols.amount))
      },
      error: () => setError("Couldn't read that file. Make sure it's a CSV export from your bank."),
    })
  }

  if (!parsed) {
    return (
      <div className="screen">
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
          <span className="dropzone-sub">or drop it here</span>
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
          onClick={() => onStart(sampleTransactions(), SAMPLE_LABEL)}
        >
          <Sparkles size={16} /> Try the sample statement
        </button>

        {resumeLabel && (
          <button type="button" className="btn btn--pile import-sample" onClick={onResume}>
            Back to “{resumeLabel}” <ArrowRight size={16} />
          </button>
        )}
      </div>
    )
  }

  const ready = !!(map.desc && map.amount) && purchases.length > 0

  return (
    <div className="screen">
      <div className="import-file">
        <FileText size={16} className="tone-pile" />
        <span className="import-file-name">{parsed.fileName}</span>
        <button
          type="button"
          className="icon-btn icon-btn--flat"
          onClick={() => setParsed(null)}
          aria-label="Choose a different file"
        >
          <X size={18} />
        </button>
      </div>
      <p className="muted import-count">{parsed.rows.length} rows found. Confirm the columns below.</p>

      <div className="panel import-map">
        <MapRow label="Description" value={map.desc} headers={parsed.headers} onChange={(desc) => setMap({ ...map, desc })} />
        <MapRow label="Amount" value={map.amount} headers={parsed.headers} onChange={(amount) => setMap({ ...map, amount })} />
        <MapRow label="Date" optional value={map.date} headers={parsed.headers} onChange={(date) => setMap({ ...map, date })} />
        <button
          type="button"
          role="switch"
          aria-checked={negative}
          className="toggle-row"
          onClick={() => setNegative(!negative)}
        >
          <span>Purchases appear as negative numbers</span>
          <span className={`toggle${negative ? ' is-on' : ''}`} aria-hidden>
            <span className="toggle-knob" />
          </span>
        </button>
      </div>

      <h3 className="section-label import-preview-label">Preview</h3>
      {purchases.length ? (
        <div className="panel preview-list">
          {purchases.slice(0, 5).map((p, i) => (
            <div key={i} className="preview-row">
              <div className="preview-main">
                <span className="preview-desc">{p.desc}</span>
                {p.date && <span className="preview-date">{p.date}</span>}
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
        onClick={() => {
          const txns = toTransactions(purchases)
          onStart(txns, parsed.fileName.replace(/\.[^.]+$/, ''))
        }}
      >
        Start review · {plural(purchases.length, 'purchase')} · <span className="num">${usd(total)}</span> <ArrowRight size={18} />
      </button>
      <p className="muted import-foot">Card payments and credits are skipped automatically.</p>
    </div>
  )
}

function MapRow(props: {
  label: string
  value: string
  headers: string[]
  optional?: boolean
  onChange: (v: string) => void
}) {
  const id = `map-${props.label.toLowerCase()}`
  return (
    <div className="map-row">
      <label htmlFor={id} className="map-label">
        {props.label}
        {props.optional && <span className="muted"> · optional</span>}
      </label>
      <select id={id} className="map-select" value={props.value} onChange={(e) => props.onChange(e.target.value)}>
        <option value="">Choose column…</option>
        {props.headers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
    </div>
  )
}
