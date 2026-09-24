// Builds small, real PDF files for tests: text drawn at x/y positions in Helvetica, like a
// computer-generated bank statement. No dependencies, so tests never need a real statement.

export interface PdfText {
  x: number
  /** From the bottom of the page, in points (a US Letter page is 612 x 792). */
  y: number
  text: string
  size?: number
}

/** Escapes text for a PDF string literal. */
const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`)

/** A PDF with one page per entry of `pages`. An empty page has no text, like a scanned image. */
export function makePdf(pages: PdfText[][]): Uint8Array<ArrayBuffer> {
  const objects: string[] = []
  const add = (body: string) => objects.push(body) // object number = index + 1
  add('<< /Type /Catalog /Pages 2 0 R >>')
  add('') // pages tree, filled in below
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  const kids: number[] = []
  for (const texts of pages) {
    const stream = texts
      .map((t) => `BT /F1 ${t.size ?? 9} Tf ${t.x} ${t.y} Td (${esc(t.text)}) Tj ET`)
      .join('\n')
    add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
    const contents = objects.length
    add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contents} 0 R >>`,
    )
    kids.push(objects.length)
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`

  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(out)
}
