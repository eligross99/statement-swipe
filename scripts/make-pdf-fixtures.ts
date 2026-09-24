// Writes the synthetic PDF statements used by tests and for trying PDF import by hand.
// Run from the repo root (Node 23+): node scripts/make-pdf-fixtures.ts

import { writeFileSync } from 'node:fs'
import { makePdf } from '../src/test/makePdf.ts'
import { sampleStatementPages } from '../src/test/statementFixture.ts'

writeFileSync('tests/fixtures/sample-statement.pdf', makePdf(sampleStatementPages()))
// A page with no text at all, like a scanned paper statement.
writeFileSync('tests/fixtures/scanned-statement.pdf', makePdf([[]]))
console.log('PDF fixtures written to tests/fixtures/')
