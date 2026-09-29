import { deviceSummary, isIos } from './appInfo'

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1'
const IPAD_AS_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Safari/605.1.15'
const ANDROID =
  'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'

describe('isIos', () => {
  it('spots iPhones, and iPads that present themselves as a Mac', () => {
    expect(isIos(IPHONE, 5)).toBe(true)
    expect(isIos(IPAD_AS_MAC, 5)).toBe(true)
    expect(isIos(IPAD_AS_MAC, 0)).toBe(false) // a real Mac
    expect(isIos(ANDROID, 5)).toBe(false)
  })
})

describe('deviceSummary', () => {
  it('names the device, its system version, and how the app is open', () => {
    expect(deviceSummary(IPHONE, 5, true)).toBe('iPhone, iOS 26.5, installed')
    expect(deviceSummary(IPHONE, 5, false)).toBe('iPhone, iOS 26.5, in Safari')
    expect(deviceSummary(ANDROID, 5, false)).toBe('Android 15, in Chrome')
    expect(deviceSummary(IPAD_AS_MAC, 0, false)).toBe('Mac, in Safari')
  })
})
