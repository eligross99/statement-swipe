import { hasCategory } from './format'

describe('hasCategory', () => {
  it('is false for the "—" placeholder and blanks, true for a real category', () => {
    expect(hasCategory('—')).toBe(false)
    expect(hasCategory('')).toBe(false)
    expect(hasCategory('Dining')).toBe(true)
  })
})
