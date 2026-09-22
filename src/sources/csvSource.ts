// The CSV implementation of TransactionSource. Import is two steps because banks vary:
// 1. `inspectCsv` reads the file and makes its best guesses (header row, columns, sign convention).
// 2. The user confirms or fixes those guesses, then `new CSVSource(...).load()` produces transactions.

import {
  detectColumns,
  detectNegativePurchases,
  findHeaderRow,
  parseGrid,
  toPurchases,
  toTable,
  toTransactions,
  type ColumnMap,
  type Grid,
  type Purchase,
  type Table,
} from '../lib/csv'
import type { Transaction, TransactionSource } from '../types'

/** How to read a CSV: which row has the column names, which columns hold what, and the sign convention. */
export interface CsvSettings {
  /** Index into the grid of the column-names row; -1 = the file has no header row. */
  headerRow: number
  map: ColumnMap
  negativePurchases: boolean
}

/** The best-guess settings for a grid, given a header row (auto-detected if omitted). */
export function guessSettings(grid: Grid, headerRow = findHeaderRow(grid)): CsvSettings {
  const { headers, rows } = toTable(grid, headerRow)
  const map = detectColumns(headers, rows)
  return { headerRow, map, negativePurchases: detectNegativePurchases(rows, map.amount) }
}

export class CSVSource implements TransactionSource {
  readonly table: Table
  private readonly settings: CsvSettings

  constructor(grid: Grid, settings: CsvSettings) {
    this.settings = settings
    this.table = toTable(grid, settings.headerRow)
  }

  /** Reads CSV text with auto-detected settings. */
  static fromText(text: string): CSVSource {
    const grid = parseGrid(text)
    return new CSVSource(grid, guessSettings(grid))
  }

  /** Purchases only, for the import preview. */
  purchases(): Purchase[] {
    return toPurchases(this.table.rows, this.settings.map, this.settings.negativePurchases)
  }

  async load(): Promise<Transaction[]> {
    return toTransactions(this.purchases())
  }
}
