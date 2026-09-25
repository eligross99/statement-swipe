import { applyTheme, resolveTheme, THEME_COLOR, THEME_KEY } from './theme'

describe('resolveTheme', () => {
  it('follows the phone for System, and otherwise uses the choice', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
})

describe('applyTheme', () => {
  it('sets the page theme and status-bar color, and remembers the choice for the next launch', () => {
    const meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.append(meta)
    applyTheme('system', 'dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(meta.getAttribute('content')).toBe(THEME_COLOR.dark)
    expect(localStorage.getItem(THEME_KEY)).toBe('system')
    meta.remove()
  })
})
