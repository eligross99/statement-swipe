// Tries each real statement in the git-ignored private/ folder in WebKit. Skipped when there are
// none (as on CI). Reports yes/no and error text only, never amounts or merchant names.
import { expect, test } from '@playwright/test'
import { existsSync, readdirSync } from 'node:fs'

const files = existsSync('private') ? readdirSync('private').filter((f) => f.toLowerCase().endsWith('.pdf')) : []

test.skip(!files.length, 'no statements in private/')

for (const file of files) {
  test(`reads private/${file}`, async ({ page }) => {
    const problems: string[] = []
    page.on('console', (m) => m.type() === 'error' && problems.push(m.text().slice(0, 200)))
    page.on('pageerror', (e) => problems.push(e.message.slice(0, 200)))
    await page.goto('/')
    await page.locator('input[type=file]').setInputFiles(`private/${file}`)
    const found = page.getByText(/purchases? found in this statement/)
    const error = page.getByRole('alert')
    await expect(found.or(error)).toBeVisible({ timeout: 20_000 })
    const message = (await error.isVisible()) ? await error.textContent() : 'none'
    const matches = await page.getByText(/^Matches the/).isVisible()
    console.log(`${file}: error shown: ${message}; totals match: ${matches ? 'yes' : 'no'}; console errors: ${problems.join(' | ') || 'none'}`)
    expect(matches).toBe(true)
  })
}
