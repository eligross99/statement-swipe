import { Share } from 'lucide-react'
import { useMemo, useState } from 'react'
import { APP_VERSION } from '../lib/appInfo'
import { FEEDBACK_EMAIL } from '../lib/feedback'
import type { Line } from '../lib/pdfLines'
import { maskedLayout } from '../lib/pdfMask'
import { shareText, type ShareResult } from '../lib/share'
import { Sheet } from './Sheet'
import './LayoutSheet.css'

interface Props {
  /** The PDF's text, as read. Only its masked form is ever shown or shared. */
  lines: Line[]
  /** What went wrong, in words with no amounts, e.g. "No purchases were found." */
  problem: string
  onClose: () => void
}

/**
 * "Help fix this for your bank": shows a PDF statement's masked layout (every letter X, every digit 9)
 * and lets the user share it through the phone's share sheet. The user sees exactly what's shared,
 * and nothing leaves the device unless they choose where to send it.
 */
export function LayoutSheet({ lines, problem, onClose }: Props) {
  const layout = useMemo(
    () =>
      maskedLayout(
        lines,
        `Statement Swipe: a masked statement layout, to help the app read this bank's PDFs.\n${problem}\nApp version: ${APP_VERSION}`,
      ),
    [lines, problem],
  )
  const [result, setResult] = useState<ShareResult | null>(null)

  return (
    <Sheet id="layout-title" title="Help fix this for your bank" onDismiss={onClose}>
      {(close) => (
        <>
          <p className="sheet-text layout-lede">
            Share how this statement is laid out, so Statement Swipe can learn to read your bank’s PDFs. Every letter
            becomes X and every number 9, so no names, purchases, amounts, or account numbers are included.
          </p>
          <h3 className="section-label">What you’ll share</h3>
          <pre className="layout-preview" tabIndex={0} aria-label="The masked layout">
            {layout}
          </pre>
          <p className="muted layout-to" role="status">
            {result === 'copied'
              ? `Copied. Paste it into an email to ${FEEDBACK_EMAIL}.`
              : result === 'failed'
                ? 'Couldn’t open sharing on this device. Try again, or send feedback from Settings instead.'
                : `Send it to ${FEEDBACK_EMAIL}.`}
          </p>
          <div className="btn-row">
            <button type="button" className="btn btn--secondary" onClick={() => close()}>
              {result === 'copied' ? 'Done' : 'Cancel'}
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={async () => {
                const r = await shareText(layout, 'statement-layout.txt')
                if (r === 'shared') close()
                else setResult(r)
              }}
            >
              <Share size={18} aria-hidden /> Share layout
            </button>
          </div>
        </>
      )}
    </Sheet>
  )
}
