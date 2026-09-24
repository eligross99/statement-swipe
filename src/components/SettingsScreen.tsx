import { ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { plural } from '../lib/format'
import { isStoragePersisted } from '../lib/storage'
import { ConfirmSheet } from './ConfirmSheet'
import './SettingsScreen.css'

interface Props {
  statementCount: number
  onEraseAll: () => void
}

/** About & privacy, and erasing everything this app has saved. */
export function SettingsScreen({ statementCount, onEraseAll }: Props) {
  const [confirming, setConfirming] = useState(false)
  // Whether the browser promised to keep our data. Checked once; null until known or if it can't say.
  const [kept, setKept] = useState<boolean | null>(null)
  useEffect(() => {
    let cancelled = false
    void isStoragePersisted().then((v) => {
      if (!cancelled) setKept(v)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="screen">
      <section className="settings-section">
        <h2 className="section-label">About and privacy</h2>
        <div className="panel settings-panel">
          <p className="settings-lead">
            <ShieldCheck size={20} className="tone-approve" aria-hidden />
            <span>Your statements stay on this device</span>
          </p>
          <p className="muted">
            Statement Swipe reads your statements right here, in your browser. They’re never uploaded, and there are
            no accounts, ads, or tracking.
          </p>
          <p className="muted">
            {statementCount ? `${plural(statementCount, 'statement')} saved on this device.` : 'No statements saved yet.'}
            {kept === true && ' Your browser has agreed to keep them.'}
            {kept === false &&
              ' Your browser may clear them if the device runs low on space. Adding this app to your Home Screen helps keep them safe.'}
          </p>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="section-label">Your data</h2>
        <button
          type="button"
          className="btn btn--flag"
          disabled={!statementCount}
          onClick={() => setConfirming(true)}
        >
          Erase everything on this device
        </button>
        <p className="muted settings-foot">Removes every statement, folder, and note this app has saved.</p>
      </section>

      {confirming && (
        <ConfirmSheet
          id="erase-title"
          title="Erase everything?"
          confirmLabel="Erase everything"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false)
            onEraseAll()
          }}
        >
          {statementCount === 1
            ? 'Your statement, with its folders and notes,'
            : `All ${statementCount} statements, with their folders and notes,`}{' '}
          will be removed from this device. This can’t be undone.
        </ConfirmSheet>
      )}
    </div>
  )
}
