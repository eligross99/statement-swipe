// Light and dark appearance. The user picks System (follow the phone), Light, or Dark in Settings.
// The page's colors switch on one attribute, <html data-theme="light|dark">, which tokens.css reads.
//
// Settings load from IndexedDB a moment after the page opens, so `public/theme.js` applies the saved
// choice before the first paint (no white flash for someone who chose Dark). It reads a copy of the
// choice kept in localStorage under THEME_KEY; `applyTheme` keeps that copy current.

export type ThemeChoice = 'system' | 'light' | 'dark'
export type Theme = 'light' | 'dark'

export const THEME_CHOICES: { value: ThemeChoice; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

/** The localStorage key `public/theme.js` reads before the app starts. Keep the two in sync. */
export const THEME_KEY = 'statement-swipe-theme'

/** The browser-bar and status-bar color for each theme: the page background (`--bg` in tokens.css). */
export const THEME_COLOR: Record<Theme, string> = { light: '#f4f7f5', dark: '#0b1410' }

export const SYSTEM_DARK = '(prefers-color-scheme: dark)'

export function resolveTheme(choice: ThemeChoice, systemDark: boolean): Theme {
  if (choice === 'system') return systemDark ? 'dark' : 'light'
  return choice
}

export function isThemeChoice(v: unknown): v is ThemeChoice {
  return v === 'system' || v === 'light' || v === 'dark'
}

/** Shows `theme` and remembers `choice` for the next launch's first paint. */
export function applyTheme(choice: ThemeChoice, theme: Theme): void {
  const root = document.documentElement
  root.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
  try {
    localStorage.setItem(THEME_KEY, choice)
  } catch {
    // Storage can be off (e.g. some private-browsing modes); the theme still applies this visit.
  }
}
