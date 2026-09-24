// @vitest-environment node
// Checks the PDF reader against real statements kept in the git-ignored private/ folder.
// Skipped when there are none (as on CI). Reports counts and yes/no answers only, never amounts,
// dates, or merchant names, so its output is safe to share while tuning the reader.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { extractLines } from './pdfSource'
import { parseStatement } from '../lib/statementPdf'

const dir = resolve(process.cwd(), 'private')
const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.pdf')) : []

/** Lines that start with a short date and end with an amount: every row the statement lists. */
const ROW_LIKE = /^\d{1,2}\/\d{1,2}\b.*\d\.\d{2}\)?(?:\s?CR|-)?$/i

describe.skipIf(!files.length)('real statements in private/', () => {
  it.each(files)('%s: purchases found add up to the printed total', async (file) => {
    const lines = await extractLines(new Uint8Array(readFileSync(resolve(dir, file))), pdfjs)
    const statement = parseStatement(lines)
    const rows = lines.filter((l) => ROW_LIKE.test(l.text)).length
    const matches = !!statement.check && Math.abs(statement.check.printed - statement.check.found) < 0.005
    console.log(
      `${file}: ${rows} dated rows, ${statement.purchases.length} purchases, ${statement.skipped} credits skipped, ` +
        `closing date found: ${statement.closing ? 'yes' : 'no'}, printed total found: ${statement.check ? 'yes' : 'no'}, ` +
        `totals match: ${matches ? 'yes' : 'no'}`,
    )
    expect(matches, 'purchases found should add up to the printed purchases total').toBe(true)
  })
})
