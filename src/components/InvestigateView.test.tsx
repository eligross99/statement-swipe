import { render, screen } from '@testing-library/react'
import type { Transaction } from '../types'
import { InvestigateView } from './InvestigateView'

const txn: Transaction = {
  id: 't1',
  desc: 'SQ *DD BAR 574123900',
  amount: 42.5,
  date: '2026-07-02',
  cat: '—',
  status: 'unreviewed',
  pileId: null,
  action: null,
  note: 'dinner with Sam',
}

describe('InvestigateView', () => {
  it('searches the web for the merchant name only, in a new tab', () => {
    const noop = vi.fn()
    render(
      <InvestigateView
        txn={txn}
        canDecide
        onBack={noop}
        onApprove={noop}
        onFlag={noop}
        onRecognize={noop}
        onSetAction={noop}
        onSetNote={noop}
      />,
    )
    const link = screen.getByRole('link', { name: 'Search the web' })
    expect(link).toHaveAttribute('href', 'https://www.google.com/search?q=DD%20BAR')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link).toHaveAccessibleDescription('Opens Google with just “DD BAR”, nothing else.')
  })
})
