import { Layers } from 'lucide-react'
import './App.css'

// Phase 1 placeholder: proves the stack, tokens, and fonts render. Replaced by the
// real screens when the prototype is ported in Phase 2.
export default function App() {
  return (
    <main className="app">
      <header className="app-header">
        <Layers aria-hidden size={20} />
        <h1>Statement Swipe</h1>
      </header>
      <article className="card">
        <p className="card-desc">TRADER JOE&apos;S #512 BOSTON MA</p>
        <p className="card-amount mono">$87.43</p>
        <p className="card-meta">Mar 03 · Groceries</p>
      </article>
      <p className="app-note">Scaffold ready. The swipe deck arrives in Phase 2.</p>
    </main>
  )
}
