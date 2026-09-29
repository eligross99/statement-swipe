// Hands text to the phone's share sheet (Mail, Messages…), so the user decides where it goes.
// Nothing is sent by the app itself.

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed'

/** Shares `text` as a small text file where the device can, else as plain text, else copies it. */
export async function shareText(text: string, fileName: string): Promise<ShareResult> {
  try {
    if (typeof navigator.share === 'function') {
      const file = new File([text], fileName, { type: 'text/plain' })
      await navigator.share(navigator.canShare?.({ files: [file] }) ? { files: [file] } : { text })
      return 'shared'
    }
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch (e) {
    // Closing the share sheet without choosing anything isn't a failure.
    return e instanceof DOMException && e.name === 'AbortError' ? 'cancelled' : 'failed'
  }
}
