import { FEEDBACK_EMAIL, feedbackMailto } from './feedback'

describe('feedbackMailto', () => {
  it('opens an email with a subject, the app version, and the device, and nothing else', () => {
    const url = new URL(feedbackMailto('iPhone, iOS 26.5, installed', 'a1b2c3d, from Tue, Sep 29, 2026'))
    expect(url.protocol).toBe('mailto:')
    expect(url.pathname).toBe(FEEDBACK_EMAIL)
    expect(url.searchParams.get('subject')).toBe('Statement Swipe feedback')
    const body = url.searchParams.get('body')!
    expect(body).toContain('App version: a1b2c3d, from Tue, Sep 29, 2026')
    expect(body).toContain('Device: iPhone, iOS 26.5, installed')
    expect(body).toContain('Nothing about your statements is included.')
  })
})
