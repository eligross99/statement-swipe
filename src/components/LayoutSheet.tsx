import { Mail } from 'lucide-react'
import { useMemo } from 'react'
import { APP_VERSION } from '../lib/appInfo'
import { layoutMailto } from '../lib/feedback'
import type { Line } from '../lib/pdfLines'
import { maskedLayout } from '../lib/pdfMask'
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
 * "Help fix this for your bank": shows a PDF statement's masked layout (every letter X, every digit 9),
 * then opens an email to the Statement Swipe team with it already in place, so the user only taps Send.
 * The user sees exactly what's shared, and nothing leaves the device unless they send it.
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

  return (
    <Sheet id="layout-title" title="Help fix this for your bank" onDismiss={onClose}>
      {(close) => (
        <>
          <p className="sheet-text layout-lede">
            Send us how this statement is laid out, so Statement Swipe can learn to read your bank’s PDFs. Every
            letter becomes X and every number 9, so no names, purchases, amounts, or account numbers are included.
          </p>
          <h3 className="section-label">What you’ll send</h3>
          <pre className="layout-preview" tabIndex={0} aria-label="The masked layout">
            {layout}
          </pre>
          <p className="muted layout-to">This opens an email with the layout already in it. Just tap Send.</p>
          <div className="btn-row">
            <button type="button" className="btn btn--secondary" onClick={() => close()}>
              Cancel
            </button>
            {/* A link, so the phone opens its mail app; the sheet slides away behind it. */}
            <a className="btn btn--primary" href={layoutMailto(layout)} onClick={() => close()}>
              <Mail size={18} aria-hidden /> Email the layout
            </a>
          </div>
        </>
      )}
    </Sheet>
  )
}
