import { canVibrate, SWIPE_TICK_MS, tick } from './haptics'

describe('haptics', () => {
  afterEach(() => {
    delete (navigator as { vibrate?: unknown }).vibrate
    delete (window as { matchMedia?: unknown }).matchMedia
  })

  /** A browser with a vibration feature, on a touch screen or not. */
  function vibrator(touch: boolean) {
    const vibrate = vi.fn(() => true)
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })
    Object.defineProperty(window, 'matchMedia', {
      value: (q: string) => ({ matches: touch && q === '(pointer: coarse)' }),
      configurable: true,
    })
    return vibrate
  }

  it('does nothing where the browser can’t vibrate (iPhone)', () => {
    expect(canVibrate()).toBe(false)
    expect(() => tick()).not.toThrow()
  })

  it('doesn’t offer vibration on a computer, which has nothing to vibrate', () => {
    const vibrate = vibrator(false)
    expect(canVibrate()).toBe(false)
    tick()
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('gives a short tick where it can (Android)', () => {
    const vibrate = vibrator(true)
    expect(canVibrate()).toBe(true)
    tick()
    expect(vibrate).toHaveBeenCalledWith(SWIPE_TICK_MS)
  })
})
