import { CircleAlert, CircleCheck, FileText, LoaderCircle, Sparkles, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useAnimate } from '../hooks/useAnimate'
import { parseGrid, type ColumnMap, type Grid, type Purchase } from '../lib/csv'
import { formatDate } from '../lib/dates'
import { plural, usd } from '../lib/format'
import { reducedMotion, token } from '../lib/motion'
import { SAMPLE_LABEL, sampleTransactions } from '../lib/sample'
import { CSVSource, guessSettings, type CsvSettings } from '../sources/csvSource'
import { isPdf, PdfImportError, PDFSource, type PdfProblem } from '../sources/pdfSource'
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

interface ParsedPdf {
  fileName: string
  source: PDFSource
}

/** What to tell the user when a PDF can't be imported, including what to try instead. */
const PDF_PROBLEMS: Record<PdfProblem, string> = {
  password: 'This PDF is locked with a password, so it can’t be read. Save an unlocked copy from your bank, or use a CSV.',
  'no-text':
    'This PDF looks like a scan, a picture of the page, so its text can’t be read. Download the statement from your bank’s app or website instead.',
  'no-purchases':
    'No purchases were found in this PDF. Make sure it’s a card statement, or try a CSV from your bank’s website.',
  unreadable: 'Couldn’t open that PDF. Try downloading it again, or use a CSV.',
}

/** The statement's name for its review: the file name without ".csv" or ".pdf". */
const labelFrom = (fileName: string) => fileName.replace(/\.[^.]+$/, '')

/** How many of the file's first lines the header-row picker offers. */
const HEADER_CHOICES = 15

export function ImportScreen({ current, onStart }: Props) {
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [settings, setSettings] = useState<CsvSettings | null>(null)
  const [pdf, setPdf] = useState<ParsedPdf | null>(null)
  // True while a PDF is being read, which can take a moment on a phone.
  const [reading, setReading] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  // A new statement waiting for the user to confirm it may replace their review.
  const [pending, setPending] = useState<PendingStart | null>(null)
  // True after removing a chosen file, so the file picker slides back in from the left.
  const [cameBack, setCameBack] = useState(false)
  const chosen = useRef<HTMLDivElement>(null)
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

  /** Fades the chosen file's screen away, then goes back to choosing a file. */
  const removeFile = () =>
    void animate(chosen.current, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, hold: true }, [
      { opacity: 1 },
      { opacity: 0 },
    ]).then(() => {
      setParsed(null)
      setSettings(null)
      setPdf(null)
      setCameBack(true)
    })

  const readPdf = async (file: File) => {
    setReading(true)
    try {
      setPdf({ fileName: file.name, source: await PDFSource.fromData(new Uint8Array(await file.arrayBuffer())) })
    } catch (e) {
      setError(
        e instanceof PdfImportError
          ? PDF_PROBLEMS[e.problem]
          : // The PDF reader itself didn't load: likely offline before it was ever saved.
            'Couldn’t load the PDF reader. Check your internet connection and try again.',
      )
    } finally {
      setReading(false)
    }
  }

  // Reading happens entirely in the browser; the file is never uploaded anywhere.
  const readFile = async (file: File) => {
    setError('')
    let grid: Grid
    try {
      if (isPdf(new Uint8Array(await file.slice(0, 1024).arrayBuffer()))) return await readPdf(file)
      grid = parseGrid(await file.text())
    } catch {
      setError('Couldn’t read that file. Make sure it’s a PDF statement or a CSV export from your bank.')
      return
    }
    if (!grid.length) {
      setError('That file looked empty.')
      return
    }
    setParsed({ fileName: file.name, grid })
    setSettings(guessSettings(grid))
  }

  if (pdf) {
    const purchases = pdf.source.purchases()
    const total = purchases.reduce((s, p) => s + p.amount, 0)
    const { check } = pdf.source.statement
    return (
      <div className="screen enter-push" key="pdf" ref={chosen}>
        <ChosenFile name={pdf.fileName} onRemove={removeFile} />
        <p className="muted import-count">{plural(purchases.length, 'purchase')} found in this statement.</p>
        {check &&
          (Math.abs(check.printed - check.found) < 0.005 ? (
            <p className="import-check">
              <CircleCheck size={18} className="tone-approve" aria-hidden />
              <span>
                Matches the <span className="num">${usd(check.printed)}</span> in purchases on your statement.
              </span>
            </p>
          ) : (
            <p className="import-check">
              <CircleAlert size={18} className="tone-investigate" aria-hidden />
              <span>
                These add up to <span className="num">${usd(check.found)}</span>, but your statement lists{' '}
                <span className="num">${usd(check.printed)}</span> in purchases. Some may be missing or extra.
              </span>
            </p>
          ))}

        <h3 className="section-label import-preview-label">Preview</h3>
        <PreviewList purchases={purchases} />
        <StartButton
          purchases={purchases}
          total={total}
          onClick={async () => start(await pdf.source.load(), labelFrom(pdf.fileName))}
        />
        {confirmSheet}
      </div>
    )
  }

  if (!parsed) {
    return (
      <div className={`screen${cameBack ? ' enter-pop' : ''}`} key="choose">
        {/* Just information: the header's back arrow is the one way back to the review. */}
        {current && <p className="import-current">Your review of “{current.label}” is saved.</p>}

        <h2 className="screen-title">Import your statement</h2>
        <p className="muted import-lede">
          Add a statement PDF from your bank’s app, or a CSV from its website. It never leaves this device.
        </p>

        <label
          className={`dropzone${dragOver ? ' is-over' : ''}${reading ? ' is-busy' : ''}`}
          aria-busy={reading}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            const f = e.dataTransfer.files?.[0]
            if (f && !reading) void readFile(f)
          }}
        >
          <span className="dropzone-icon">
            {reading ? <LoaderCircle size={24} className="spin" /> : <FileText size={24} />}
          </span>
          <span className="dropzone-title" role="status">
            {reading ? 'Reading your statement…' : 'Choose a statement'}
          </span>
          <span className="dropzone-sub">
            PDF or CSV<span className="dropzone-drag">, or drag it here</span>
          </span>
          <input
            type="file"
            accept=".pdf,application/pdf,.csv,text/csv"
            disabled={reading}
            className="visually-hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void readFile(f)
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
    <div className="screen enter-push" key="map" ref={chosen}>
      <ChosenFile name={parsed.fileName} onRemove={removeFile} />
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
        <PreviewList purchases={purchases} key={JSON.stringify(settings)} />
      ) : (
        <p className="import-error">
          No purchases found with these columns. Check the Amount column, or flip the negative-numbers switch above.
        </p>
      )}

      <StartButton
        purchases={purchases}
        total={total}
        disabled={!ready}
        onClick={async () => start(await source.load(), labelFrom(parsed.fileName))}
      />
      {confirmSheet}
    </div>
  )
}

/** The chosen file's name, with a button to pick a different one. */
function ChosenFile({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <div className="import-file">
      <FileText size={16} className="tone-pile" />
      <span className="import-file-name">{name}</span>
      <button type="button" className="icon-btn icon-btn--flat" onClick={onRemove} aria-label="Choose a different file">
        <X size={18} />
      </button>
    </div>
  )
}

/** How many purchases the preview shows before "Show all". */
const PREVIEW_ROWS = 5

/** The first few purchases found, with a button to show them all and to show fewer again. */
function PreviewList({ purchases }: { purchases: Purchase[] }) {
  const [all, setAll] = useState(false)
  const toggle = useRef<HTMLButtonElement>(null)
  const shown = all ? purchases : purchases.slice(0, PREVIEW_ROWS)

  const showFewer = () => {
    setAll(false)
    // The list just got much shorter, so bring the button back into view instead of leaving
    // the user looking at empty space below it.
    requestAnimationFrame(() =>
      toggle.current?.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' }),
    )
  }

  return (
    <>
      <div className="panel preview-list enter-fade">
        {shown.map((p, i) => (
          // Rows revealed by "Show all" fade in.
          <div key={i} className={`preview-row${i >= PREVIEW_ROWS ? ' enter-fade' : ''}`}>
            <div className="preview-main">
              <span className="preview-desc">{p.desc}</span>
              {p.date && <span className="preview-date">{formatDate(p.date)}</span>}
            </div>
            <span className="preview-amount num">${usd(p.amount)}</span>
          </div>
        ))}
      </div>
      {purchases.length > PREVIEW_ROWS && (
        <button
          ref={toggle}
          type="button"
          className="btn btn--quiet import-more"
          aria-expanded={all}
          onClick={all ? showFewer : () => setAll(true)}
        >
          {all ? 'Show fewer' : `Show all ${purchases.length}`}
        </button>
      )}
    </>
  )
}

function StartButton(props: { purchases: Purchase[]; total: number; disabled?: boolean; onClick: () => void }) {
  return (
    <>
      <button type="button" className="btn btn--primary import-start" disabled={props.disabled} onClick={props.onClick}>
        Review {plural(props.purchases.length, 'purchase')}, <span className="num">${usd(props.total)}</span>
      </button>
      <p className="muted import-foot">Card payments and credits are skipped automatically.</p>
    </>
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
