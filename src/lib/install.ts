// Adding the app to the Home Screen. Installed, it opens full screen, and the browser keeps its saved
// statements: Safari can clear a website's data after about a week without a visit, but not an
// installed app's. How to install depends on the phone:
// - iPhone: only by hand, from Safari's Share menu, so the app shows the steps.
// - Android (Chrome): the browser offers an install prompt, which the app shows from its own button.

import { isInstalled, isIos } from './appInfo'

/** Chrome's install prompt event (not in TypeScript's built-in types yet). */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
}

export type InstallWay = 'ios' | 'prompt' | null

let deferred: InstallPromptEvent | null = null
const listeners = new Set<() => void>()
const changed = () => listeners.forEach((l) => l())

/** Starts listening for the browser's install prompt. Called once at startup, because the browser
 *  offers it only once, early, and it must be kept until the user taps Install. */
export function listenForInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // no mini-infobar: the app's own card offers it instead
    deferred = e as InstallPromptEvent
    changed()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    changed()
  })
}

/** How this device can install the app, or null when it's installed already or can't be. */
export function installWay(): InstallWay {
  if (isInstalled()) return null
  if (isIos()) return 'ios'
  return deferred ? 'prompt' : null
}

/** Shows the browser's own install prompt (Android). */
export async function promptInstall(): Promise<void> {
  const e = deferred
  if (!e) return
  deferred = null
  await e.prompt()
  changed()
}

export function subscribeInstall(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
