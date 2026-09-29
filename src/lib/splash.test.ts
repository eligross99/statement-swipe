import { hideSplash } from './splash'

describe('hideSplash', () => {
  it('removes the launch screen, and is safe to call again', () => {
    document.body.insertAdjacentHTML('afterbegin', '<div id="splash"><svg></svg></div>')
    hideSplash()
    expect(document.getElementById('splash')).toBeNull()
    expect(() => hideSplash()).not.toThrow()
  })
})
