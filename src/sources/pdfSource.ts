// The PDF implementation of TransactionSource. Reads a statement PDF entirely on this device with
// Mozilla's PDF reader (pdfjs), which is downloaded only the first time someone picks a PDF.
// 1. `extractLines` pulls the text out of every page, as lines (see pdfLines.ts).
// 2. `parseStatement` finds the purchases (see statementPdf.ts).

import { toTransactions, type Purchase } from '../lib/csv'
import { toLines, type Line, type TextFragment } from '../lib/pdfLines'
import { parseStatement, type PdfStatement } from '../lib/statementPdf'
import type { Transaction, TransactionSource } from '../types'

type Pdfjs = typeof import('pdfjs-dist/legacy/build/pdf.mjs')

/** Why a PDF couldn't be imported, for a message that says what to do next. */
export type PdfProblem = 'password' | 'no-text' | 'no-purchases' | 'unreadable'

export class PdfImportError extends Error {
  readonly problem: PdfProblem
  constructor(problem: PdfProblem) {
    super(problem)
    this.problem = problem
  }
}

/** Fewer characters than this across the whole file means it's a scan (a picture of text). */
const MIN_TEXT = 40

/** True when the bytes are a PDF, whatever the file is named. */
export function isPdf(head: Uint8Array): boolean {
  return new TextDecoder().decode(head.subarray(0, 1024)).includes('%PDF-')
}

let loading: Promise<Pdfjs> | null = null

/** Loads the PDF reader once. The legacy build supports older iPhones and Android phones. */
function loadPdfjs(): Promise<Pdfjs> {
  loading ??= Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]).then(([pdfjs, worker]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
    return pdfjs
  })
  // If loading fails (say, offline before the reader was ever saved), let the next try start over.
  loading.catch(() => (loading = null))
  return loading
}

/** Every page's text as lines, top to bottom. `pdfjs` is passed in by tests, which run in Node. */
export async function extractLines(data: Uint8Array, pdfjs?: Pdfjs): Promise<Line[]> {
  const lib = pdfjs ?? (await loadPdfjs())
  const task = lib.getDocument({ data, verbosity: 0, useWorkerFetch: false, useWasm: false, enableXfa: false })
  let doc
  try {
    doc = await task.promise
  } catch (e) {
    void task.destroy()
    throw new PdfImportError(e instanceof lib.PasswordException ? 'password' : 'unreadable')
  }
  try {
    const lines: Line[] = []
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p)
      const content = await page.getTextContent()
      const fragments: TextFragment[] = []
      for (const item of content.items) {
        if (!('str' in item)) continue
        const [, , c, d, x, y] = item.transform as number[]
        fragments.push({ str: item.str, x, y, width: item.width, size: Math.hypot(c, d) })
      }
      lines.push(...toLines(fragments, p))
    }
    return lines
  } catch {
    throw new PdfImportError('unreadable')
  } finally {
    void task.destroy()
  }
}

export class PDFSource implements TransactionSource {
  readonly statement: PdfStatement

  constructor(statement: PdfStatement) {
    this.statement = statement
  }

  /** Reads a statement PDF. Throws a PdfImportError when it can't find purchases in it. */
  static async fromData(data: Uint8Array, pdfjs?: Pdfjs): Promise<PDFSource> {
    const lines = await extractLines(data, pdfjs)
    if (lines.reduce((n, l) => n + l.text.length, 0) < MIN_TEXT) throw new PdfImportError('no-text')
    const statement = parseStatement(lines)
    if (!statement.purchases.length) throw new PdfImportError('no-purchases')
    return new PDFSource(statement)
  }

  /** Purchases only, for the import preview. */
  purchases(): Purchase[] {
    return this.statement.purchases
  }

  async load(): Promise<Transaction[]> {
    return toTransactions(this.statement.purchases)
  }
}
