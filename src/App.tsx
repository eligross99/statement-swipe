import { Check, FolderInput, Search } from 'lucide-react'
import './App.css'

// Phase 1 placeholder: a static style preview of the card and the three actions.
// Replaced by the real deck when the prototype is ported in Phase 2.
export default function App() {
  return (
    <main className="app">
      <header className="app-header">
        <span className="brand-mark" aria-hidden>
          <Check size={16} strokeWidth={3} />
        </span>
        <h1>Statement Swipe</h1>
      </header>

      <section className="progress" aria-label="Review progress">
        <div className="progress-row">
          <span>3 of 12 reviewed</span>
          <span className="num">$412.08 of $1,286.40</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: '25%' }} />
        </div>
      </section>

      <article className="card">
        <div className="card-top">
          <span className="chip">Groceries</span>
          <span className="card-date">Mar 03</span>
        </div>
        <p className="card-amount num">$87.43</p>
        <p className="card-desc">TRADER JOE&apos;S #512 BOSTON MA</p>
      </article>

      <div className="actions" aria-label="Actions (preview)">
        <button type="button" className="action action--investigate">
          <Search size={20} aria-hidden />
          Look closer
        </button>
        <button type="button" className="action action--pile">
          <FolderInput size={20} aria-hidden />
          File
        </button>
        <button type="button" className="action action--approve">
          <Check size={20} aria-hidden />
          Recognized
        </button>
      </div>

      <p className="app-note">Style preview. The swipe deck arrives in Phase 2.</p>
    </main>
  )
}
