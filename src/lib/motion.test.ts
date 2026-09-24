import { screenEnter } from './motion'

describe('screenEnter', () => {
  it('slides forward screens in from the right and back screens from the left', () => {
    expect(screenEnter('summary', 'pile')).toBe('push')
    expect(screenEnter('pile', 'summary')).toBe('pop')
    expect(screenEnter('statements', 'import')).toBe('push')
    expect(screenEnter('statements', 'deck')).toBe('push')
    expect(screenEnter('statements', 'settings')).toBe('push')
    expect(screenEnter('summary', 'statements')).toBe('pop')
    expect(screenEnter('settings', 'statements')).toBe('pop')
  })

  it('rises into the summary after the last card, and into a review from the import screen', () => {
    expect(screenEnter('deck', 'summary')).toBe('rise')
    expect(screenEnter('import', 'deck')).toBe('rise')
  })

  it('fades for other changes, like undo from the summary', () => {
    expect(screenEnter('summary', 'deck')).toBe('fade')
  })

  it('does nothing when the screen stays the same', () => {
    expect(screenEnter('deck', 'deck')).toBe('none')
  })
})
