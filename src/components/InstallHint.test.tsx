import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InstallHint } from './InstallHint'

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1'

afterEach(() => vi.restoreAllMocks())

describe('InstallHint', () => {
  it('shows nothing on a computer', () => {
    const { container } = render(<InstallHint hasStatements={false} onHide={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('on an iPhone in Safari, shows the steps, and hides for good on Not now', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE)
    const onHide = vi.fn()
    const user = userEvent.setup()
    render(<InstallHint hasStatements onHide={onHide} />)

    expect(screen.getByRole('heading', { name: 'Add Swipe to your Home Screen' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show me how' }))
    const steps = screen.getByRole('dialog', { name: 'Add to your Home Screen' })
    expect(steps).toHaveTextContent('Tap View More, then Add to Home Screen.')
    // Statements added in Safari don't move to the Home Screen app, so say so.
    expect(steps).toHaveTextContent('Statements you’ve added here stay in Safari')

    await user.click(screen.getByRole('button', { name: 'Not now' }))
    expect(onHide).toHaveBeenCalled()
  })
})
