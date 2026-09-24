import { FileText, ListChecks } from 'lucide-react'
import type { Tab } from '../lib/library'
import './TabBar.css'

interface Props {
  tab: Tab
  /** Overdue tasks, shown as a number on the Tasks tab. */
  overdue: number
  onGo: (tab: Tab) => void
}

/** The bottom tab bar: Statements and Tasks. Hidden while reviewing, so the cards get the screen. */
export function TabBar({ tab, overdue, onGo }: Props) {
  return (
    <nav className="tabbar" aria-label="Main">
      <TabButton here={tab === 'statements'} label="Statements" onClick={() => onGo('statements')}>
        <FileText size={22} aria-hidden />
      </TabButton>
      <TabButton
        here={tab === 'tasks'}
        label="Tasks"
        extra={overdue > 0 ? `, ${overdue} overdue` : ''}
        onClick={() => onGo('tasks')}
      >
        <span className="tab-icon">
          <ListChecks size={22} aria-hidden />
          {overdue > 0 && (
            <span className="tab-badge num" aria-hidden>
              {overdue > 99 ? '99+' : overdue}
            </span>
          )}
        </span>
      </TabButton>
    </nav>
  )
}

interface TabButtonProps {
  here: boolean
  label: string
  /** Extra words for screen readers, e.g. the overdue count. */
  extra?: string
  onClick: () => void
  children: React.ReactNode
}

function TabButton({ here, label, extra = '', onClick, children }: TabButtonProps) {
  return (
    <button
      type="button"
      className={`tab${here ? ' is-here' : ''}`}
      aria-current={here ? 'page' : undefined}
      aria-label={label + extra}
      onClick={onClick}
    >
      {children}
      <span className="tab-label">{label}</span>
    </button>
  )
}
