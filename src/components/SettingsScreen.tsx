import { Mail, ShieldCheck, SquarePlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useInstall } from '../hooks/useInstall'
import { APP_VERSION } from '../lib/appInfo'
import { feedbackMailto } from '../lib/feedback'
import { plural } from '../lib/format'
import { canVibrate } from '../lib/haptics'
import type { Settings } from '../lib/library'
import { promptInstall } from '../lib/install'
import { isStoragePersisted } from '../lib/storage'
import { REMIND_CHOICES } from '../lib/tasks'
import { THEME_CHOICES } from '../lib/theme'
import { ConfirmSheet } from './ConfirmSheet'
import { InstallSteps } from './InstallHint'
import { Segmented } from './Segmented'
import './SettingsScreen.css'

interface Props {
  statementCount: number
  settings: Settings
  onChange: (change: Partial<Settings>) => void
  onEraseAll: () => void
  onReplayTour: () => void
}

/** Appearance, swiping, filing, and Tasks preferences, the tour, About & privacy, and erasing everything saved. */
export function SettingsScreen({ statementCount, settings, onChange, onEraseAll, onReplayTour }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [installSteps, setInstallSteps] = useState(false)
  // How this phone can add the app to its Home Screen; null once installed (or on a computer).
  const install = useInstall()
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
        <h2 className="section-label">Appearance</h2>
        <Segmented
          label="Appearance"
          options={THEME_CHOICES}
          value={settings.theme}
          onChange={(theme) => onChange({ theme })}
        />
        <p className="muted settings-foot">
          {settings.theme === 'system' ? 'Light or dark, following your phone’s setting.' : 'Always, whatever your phone’s setting.'}
        </p>
      </section>

      {/* Only where the browser can vibrate (Android): on iPhone the switch would do nothing. */}
      {canVibrate() && (
        <section className="settings-section">
          <h2 className="section-label">Swiping</h2>
          <div className="panel settings-panel">
            <button
              type="button"
              role="switch"
              aria-checked={settings.haptics}
              className="toggle-row settings-toggle settings-toggle--alone"
              onClick={() => onChange({ haptics: !settings.haptics })}
            >
              <span>Vibrate when a swipe lands</span>
              <span className={`toggle${settings.haptics ? ' is-on' : ''}`} aria-hidden>
                <span className="toggle-knob" />
              </span>
            </button>
          </div>
        </section>
      )}

      <section className="settings-section">
        <h2 className="section-label">Filing</h2>
        <div className="panel settings-panel">
          <button
            type="button"
            role="switch"
            aria-checked={settings.suggestFolders}
            aria-describedby="suggest-folders-help"
            className="toggle-row settings-toggle"
            onClick={() => onChange({ suggestFolders: !settings.suggestFolders })}
          >
            <span>Suggest past folder names</span>
            <span className={`toggle${settings.suggestFolders ? ' is-on' : ''}`} aria-hidden>
              <span className="toggle-knob" />
            </span>
          </button>
          <p id="suggest-folders-help" className="muted">
            When you file a purchase, names like “Taxes” that you’ve used before are one tap away. Each statement
            still starts with no folders, and folders are never shared between statements.
          </p>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="section-label">Tasks</h2>
        <div className="panel settings-panel">
          <div className="settings-row">
            <label htmlFor="remind-after">Remind me after</label>
            <select
              id="remind-after"
              className="settings-select"
              aria-describedby="remind-after-help"
              value={settings.remindAfterDays ?? 'off'}
              onChange={(e) =>
                onChange({ remindAfterDays: e.target.value === 'off' ? null : Number(e.target.value) })
              }
            >
              {REMIND_CHOICES.map(({ days, label }) => (
                <option key={label} value={days ?? 'off'}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <p id="remind-after-help" className="muted">
            {settings.remindAfterDays === null
              ? 'Tasks are never marked Overdue.'
              : 'Open tasks you haven’t touched for this long are marked Overdue, and the Tasks tab shows how many.'}
          </p>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="section-label">Help</h2>
        <button type="button" className="btn btn--secondary" onClick={onReplayTour}>
          Replay the tour
        </button>
        <p className="muted settings-foot">
          Practice swiping on a pretend statement again. Your own statements stay as they are.
        </p>
        {install && (
          <>
            <button
              type="button"
              className="btn btn--secondary settings-more"
              onClick={() => (install === 'ios' ? setInstallSteps(true) : void promptInstall())}
            >
              <SquarePlus size={18} aria-hidden /> Add to Home Screen
            </button>
            <p className="muted settings-foot">Swipe opens full screen, like an app, and keeps your statements safe.</p>
          </>
        )}
        <a className="btn btn--secondary settings-more" href={feedbackMailto()}>
          <Mail size={18} aria-hidden /> Send feedback
        </a>
        <p className="muted settings-foot">
          Tell us what’s confusing, broken, or missing. Opens an email with the app version and your kind of phone,
          never anything from your statements.
        </p>
      </section>

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
            Only two things ever leave this device, and only when you tap them: a merchant’s name when you search the
            web, and a statement’s masked layout if you send it.
          </p>
          <p className="muted">
            {statementCount ? `${plural(statementCount, 'statement')} saved on this device.` : 'No statements saved yet.'}
            {kept === true && ' Your browser has agreed to keep them.'}
            {kept === false &&
              ' Your browser may clear them if the device runs low on space. Adding this app to your Home Screen helps keep them safe.'}
          </p>
          <p className="muted">App version {APP_VERSION}.</p>
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

      {installSteps && <InstallSteps hasStatements={statementCount > 0} onClose={() => setInstallSteps(false)} />}

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
