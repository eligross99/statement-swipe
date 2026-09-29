import { merchantQuery, webSearchUrl } from './webSearch'

describe('merchantQuery', () => {
  it('drops payment-service codes, store numbers, and reference codes', () => {
    expect(merchantQuery('SQ *DD BAR')).toBe('DD BAR')
    expect(merchantQuery('TST* JOES DINER')).toBe('JOES DINER')
    expect(merchantQuery('SHELL OIL 574123900 AUSTIN TX')).toBe('SHELL OIL AUSTIN TX')
    expect(merchantQuery('AMZN MKTP US*2K4AB1CD2')).toBe('AMZN MKTP US')
    expect(merchantQuery("TRADER JOE'S #512 BOSTON MA")).toBe("TRADER JOE'S #512 BOSTON MA")
  })

  it('keeps short numbers that are part of a name', () => {
    expect(merchantQuery('7-ELEVEN 12')).toBe('7-ELEVEN 12')
  })

  it('falls back to the original text when nothing would be left', () => {
    expect(merchantQuery('123456789')).toBe('123456789')
  })
})

describe('webSearchUrl', () => {
  it('searches Google for the merchant name only', () => {
    expect(webSearchUrl('SQ *DD BAR & GRILL')).toBe('https://www.google.com/search?q=DD%20BAR%20%26%20GRILL')
  })
})
