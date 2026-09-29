// Which build of the app is running, and on what kind of device, for feedback emails and Settings.
// Nothing here is personal: no statements, and nothing is sent anywhere by this file.

import { formatDate } from './dates'

// Filled in when the app is built (see `define` in vite.config.ts).
declare const __APP_COMMIT__: string
declare const __APP_BUILT__: string

/** "a1b2c3d, from Tue, Sep 29, 2026": the commit this build came from and the day it was built. */
export const APP_VERSION = `${__APP_COMMIT__}, from ${formatDate(__APP_BUILT__, 'long')}`

/** True when the app was opened from the Home Screen (installed), not in a browser tab. */
export function isInstalled(): boolean {
  const iosHomeScreen = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosHomeScreen || (window.matchMedia?.('(display-mode: standalone)').matches ?? false)
}

/** True on an iPhone or iPad, including iPads that present themselves as a Mac. */
export function isIos(ua: string = navigator.userAgent, touchPoints: number = navigator.maxTouchPoints): boolean {
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1)
}

/** A short description of the device for a bug report, e.g. "iPhone, iOS 26.5, installed". */
export function deviceSummary(ua: string, touchPoints: number, installed: boolean): string {
  let device = 'Unknown device'
  const ios = /OS (\d+)_(\d+)/.exec(ua)
  const android = /Android (\d+(?:\.\d+)?)/.exec(ua)
  if (/iPhone|iPod/.test(ua)) device = `iPhone${ios ? `, iOS ${ios[1]}.${ios[2]}` : ''}`
  else if (isIos(ua, touchPoints)) device = `iPad${ios ? `, iPadOS ${ios[1]}.${ios[2]}` : ''}`
  else if (android) device = `Android ${android[1]}`
  else if (/Macintosh/.test(ua)) device = 'Mac'
  else if (/Windows/.test(ua)) device = 'Windows'
  const browser = /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : ''
  const parts = [device, installed ? 'installed' : browser ? `in ${browser}` : '']
  return parts.filter(Boolean).join(', ')
}
