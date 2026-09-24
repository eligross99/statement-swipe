// Turns a PDF page's loose text fragments into lines and columns.
// A PDF has no "rows": it's text drawn at x/y positions, often one word (or one letter) at a time.
// Fragments at the same height form a line; big horizontal gaps split a line into cells (columns).
// Pure, dependency-free code, so scripts/pdf-layout.ts can run it with Node directly.

/** One fragment of text as the PDF reader reports it. Coordinates are PDF points, y grows upward. */
export interface TextFragment {
  str: string
  x: number
  y: number
  width: number
  /** Font size, roughly. */
  size: number
}

export interface Cell {
  x: number
  text: string
}

export interface Line {
  page: number
  y: number
  /** Left to right. */
  cells: Cell[]
  /** All cells joined with single spaces. */
  text: string
}

/** Fragments whose baselines differ by less than this share of the font size are on one line. */
const SAME_LINE = 0.45
/** A gap wider than this share of the font size starts a new word. */
const WORD_GAP = 0.12
/** A gap wider than this share of the font size starts a new column. */
const CELL_GAP = 1.1

/** Groups one page's fragments into lines, top to bottom. */
export function toLines(fragments: TextFragment[], page = 1): Line[] {
  const items = fragments.filter((f) => f.str.trim() !== '').sort((a, b) => b.y - a.y || a.x - b.x)
  const groups: TextFragment[][] = []
  for (const f of items) {
    const group = groups[groups.length - 1]
    const size = Math.max(f.size, 1)
    if (group && Math.abs(group[0].y - f.y) < size * SAME_LINE) group.push(f)
    else groups.push([f])
  }
  return groups.map((group) => {
    group.sort((a, b) => a.x - b.x)
    const cells: Cell[] = []
    let end = -Infinity
    for (const f of group) {
      const gap = f.x - end
      const size = Math.max(f.size, 1)
      const cell = cells[cells.length - 1]
      if (!cell || gap > size * CELL_GAP) cells.push({ x: f.x, text: f.str.trim() })
      else cell.text += (gap > size * WORD_GAP && !f.str.startsWith(' ') ? ' ' : '') + f.str.trimEnd()
      end = Math.max(end, f.x + f.width)
    }
    for (const c of cells) c.text = c.text.replace(/\s+/g, ' ').trim()
    const kept = cells.filter((c) => c.text)
    return { page, y: Math.round(group[0].y), cells: kept, text: kept.map((c) => c.text).join(' ') }
  })
}
