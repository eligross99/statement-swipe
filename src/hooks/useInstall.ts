import { useSyncExternalStore } from 'react'
import { installWay, subscribeInstall } from '../lib/install'

/** How this device can add the app to its Home Screen, kept current (see src/lib/install.ts). */
export function useInstall() {
  return useSyncExternalStore(subscribeInstall, installWay)
}
