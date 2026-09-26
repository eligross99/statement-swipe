import { ChevronDown, Share } from 'lucide-react'
import { useState } from 'react'
import { BANK_GUIDES, GUIDES_CHECKED, type BankGuide } from '../lib/bankGuides'
import { SlideOver } from './SlideOver'
import './GuidePage.css'

interface Props {
  onBack: () => void
}

/**
 * "Get your statement": how to download a statement from the biggest card issuers, one bank open at a
 * time. Slides over the Import screen, opened from its "How do I get my file?" link and at the end of
 * the tour. Plain text shipped with the app; nothing is fetched.
 */
export function GuidePage({ onBack }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <SlideOver labelledBy="guide-title" backLabel="Back to import" onBack={onBack}>
      {() => (
        <>
          <h2 id="guide-title" className="screen-title">
            Get your statement
          </h2>
          <p className="muted guide-lede">
            Most banks let you save a statement PDF in their app. On a computer, you can also download a CSV of your
            purchases.
          </p>

          <div className="panel guide-tip">
            <Share size={20} className="tone-approve" aria-hidden />
            <p>
              <strong>On an iPhone:</strong> when the PDF opens, tap Share, then Save to Files. Then come back here
              and choose it.
            </p>
          </div>

          <h3 className="section-label guide-label">Pick your bank</h3>
          <ul className="guide-list">
            {BANK_GUIDES.map((g) => (
              <Guide
                key={g.id}
                guide={g}
                open={openId === g.id}
                onToggle={() => setOpenId(openId === g.id ? null : g.id)}
              />
            ))}
          </ul>

          <p className="muted guide-foot">
            Checked in {GUIDES_CHECKED}. Banks sometimes move their buttons: if a step doesn’t match, look for
            Statements or Download.
          </p>
        </>
      )}
    </SlideOver>
  )
}

/** One bank: its name, which opens its steps below it (growing smoothly, and shrinking back). */
function Guide({ guide, open, onToggle }: { guide: BankGuide; open: boolean; onToggle: () => void }) {
  const bodyId = `guide-${guide.id}`
  return (
    <li className={`panel guide${open ? ' is-open' : ''}`}>
      <button type="button" className="guide-head" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
        <span>{guide.name}</span>
        <ChevronDown size={20} className="guide-chevron" aria-hidden />
      </button>
      {/* Closed steps stay in the page (so they can grow and shrink) but out of reach until opened. */}
      <div id={bodyId} className="guide-body" inert={!open}>
        <div className="guide-body-inner">
          <div className="guide-body-content">
            <Steps title="In the app" steps={guide.phone} />
            <Steps title="On a computer" steps={guide.computer} />
            {guide.note && <p className="muted guide-note">{guide.note}</p>}
          </div>
        </div>
      </div>
    </li>
  )
}

function Steps({ title, steps }: { title: string; steps: string[] }) {
  if (!steps.length) return null
  return (
    <>
      <h4 className="guide-steps-title">{title}</h4>
      <ol className="guide-steps">
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
    </>
  )
}
