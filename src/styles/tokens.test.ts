// @vitest-environment node
import { readFileSync } from 'node:fs'

// Checks that text stays readable in both themes: every pair of text color and background it sits on
// needs a contrast ratio of at least 4.5:1 (the WCAG AA level for normal text).

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')

/** The hex color tokens in the block that starts with `selector`. */
function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`)
  const block = css.slice(start, css.indexOf('\n}', start))
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1], m[2]]))
}

const light = tokens(':root')
const dark = { ...light, ...tokens(":root[data-theme='dark']") }

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** [text, background] pairs the app actually uses. */
const PAIRS: [string, string][] = [
  ...['text', 'text-mute'].flatMap((t) => ['bg', 'surface', 'surface-sunken'].map((b): [string, string] => [t, b])),
  ...['approve', 'investigate', 'pile', 'flag', 'wait', 'brand'].map((c): [string, string] => [c, 'surface']),
  ['brand', 'bg'],
  ['approve', 'approve-tint'],
  ['investigate', 'investigate-tint'],
  ['pile', 'pile-tint'],
  ['flag', 'flag-tint'],
  ['wait', 'wait-tint'],
  ['brand-strong', 'brand-tint'],
  ['on-brand', 'brand'],
  ['on-brand', 'approve'],
  ['on-brand', 'investigate'], // the overdue badge on the Tasks tab
  ['dock-pill-text', 'dock-pill'],
]

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme', (_name, theme) => {
  it.each(PAIRS)('%s text on %s is readable', (text, bg) => {
    expect(theme[text], text).toBeDefined()
    expect(theme[bg], bg).toBeDefined()
    expect(contrast(theme[text], theme[bg])).toBeGreaterThanOrEqual(4.5)
  })
})

it('gives every hex color token a dark value too', () => {
  const own = tokens(":root[data-theme='dark']")
  expect(Object.keys(light).filter((k) => !(k in own))).toEqual([])
})
