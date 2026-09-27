import { BANK_GUIDES } from './bankGuides'

describe('bank guides', () => {
  it('give every bank a unique id and steps for its app', () => {
    expect(new Set(BANK_GUIDES.map((g) => g.id)).size).toBe(BANK_GUIDES.length)
    for (const g of BANK_GUIDES) expect(g.phone.length, g.name).toBeGreaterThan(0)
  })

  it('end with a catch-all for other banks', () => {
    expect(BANK_GUIDES.at(-1)?.name).toBe('Another bank')
  })

  it('write steps as sentences, with no "→" arrows', () => {
    for (const s of BANK_GUIDES.flatMap((g) => [...g.phone, ...g.computer])) {
      expect(s).toMatch(/\.$/)
      expect(s).not.toContain('→')
    }
  })
})
