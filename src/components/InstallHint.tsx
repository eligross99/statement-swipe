import { Share, SquarePlus, ToggleRight } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { useAnimate } from '../hooks/useAnimate'
import { useInstall } from '../hooks/useInstall'
import { promptInstall } from '../lib/install'
import { Sheet } from './Sheet'
import './InstallHint.css'

interface Props {
  /** Whether statements were already added in the browser: they don't move to the Home Screen app. */
  hasStatements: boolean
  /** "Not now": the card folds away and doesn't come back (the steps stay in Settings). */
  onHide: () => void
}

/**
 * A quiet card suggesting the user add the app to their Home Screen, shown only on phones where it
 * isn't installed yet. Installed, it opens full screen and its statements are kept: Safari can clear
 * a website's data after about a week without a visit. See src/lib/install.ts.
 */
export function InstallHint({ hasStatements, onHide }: Props) {
  const way = useInstall()
  const [steps, setSteps] = useState(false)
  const card = useRef<HTMLElement>(null)
  const animate = useAnimate()
  if (!way) return null

  /** Folds the card away, so the user sees where it went, then hides it for good. */
  const hide = () => {
    const h = card.current?.offsetHeight ?? 0
    void animate(
      card.current,
      [
        { opacity: 1, height: `${h}px`, marginBottom: '14px' },
        { opacity: 0, height: '0px', marginBottom: '0px' },
      ],
      { duration: 320, hold: true },
      [{ opacity: 1 }, { opacity: 0 }],
    ).then(onHide)
  }

  return (
    <section ref={card} className="panel install-hint" aria-labelledby="install-hint-title">
      <div className="install-hint-body">
        <span className="install-hint-icon" aria-hidden>
          <SquarePlus size={22} />
        </span>
        <div>
          <h2 id="install-hint-title" className="install-hint-title">
            Add Swipe to your Home Screen
          </h2>
          <p className="muted install-hint-text">It opens full screen, like an app, and keeps your statements safe.</p>
        </div>
      </div>
      <div className="btn-row">
        <button type="button" className="btn btn--secondary" onClick={hide}>
          Not now
        </button>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => (way === 'ios' ? setSteps(true) : void promptInstall())}
        >
          {way === 'ios' ? 'Show me how' : 'Install'}
        </button>
      </div>
      {steps && <InstallSteps hasStatements={hasStatements} onClose={() => setSteps(false)} />}
    </section>
  )
}

/** The iPhone steps for adding the app to the Home Screen (checked in iOS 26 Safari). Also opened
 *  from Settings. */
export function InstallSteps({ hasStatements, onClose }: { hasStatements: boolean; onClose: () => void }) {
  return (
    <Sheet id="install-steps-title" title="Add to your Home Screen" onDismiss={onClose}>
      {(close) => (
        <>
          <ol className="install-steps">
            {/* On iPhones before iOS 26, Share sits in Safari's bottom bar instead: this wording fits both. */}
            <Step icon={<Share size={20} />}>
              In Safari, tap <strong>Share</strong>. It’s in the ⋯ menu beside the address bar.
            </Step>
            <Step icon={<SquarePlus size={20} />}>
              Tap <strong>View More</strong>, then <strong>Add to Home Screen</strong>.
            </Step>
            <Step icon={<ToggleRight size={20} />}>
              Keep <strong>Open as Web App</strong> on, and tap <strong>Add</strong>.
            </Step>
          </ol>
          <p className="sheet-text install-steps-after">
            {hasStatements
              ? 'Then open Swipe from your Home Screen. Statements you’ve added here stay in Safari, so import them again there.'
              : 'Then open Swipe from your Home Screen, and import your statements there.'}
          </p>
          <button type="button" className="btn btn--secondary" onClick={() => close()}>
            Got it
          </button>
        </>
      )}
    </Sheet>
  )
}

function Step({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="install-step">
      <span className="install-step-icon" aria-hidden>
        {icon}
      </span>
      <span>{children}</span>
    </li>
  )
}
