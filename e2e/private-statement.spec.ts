// Tries each real statement in the git-ignored private/ folder in WebKit. Skipped when there are
// none (as on CI). Reports yes/no and error text only, never amounts or merchant names.
import { existsSync, readdirSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { openApp } from './app.ts'

const files = existsSync('private') ? readdirSync('private').filter((f) => f.toLowerCase().endsWith('.pdf')) : []

test.skip(!files.length, 'no statements in private/')

for (const file of files) {
  test(`reads private/${file}`, async ({ page }) => {
    const problems: string[] = []
    page.on('console', (m) => m.type() === 'error' && problems.push(m.text().slice(0, 200)))
    page.on('pageerror', (e) => problems.push(e.message.slice(0, 200)))
    await openApp(page)
    await page.getByRole('button', { name: 'Import a statement' }).click()
    await page.locator('input[type=file]').setInputFiles(`private/${file}`)
    const found = page.getByText(/purchases? found in this statement/)
    const error = page.getByRole('alert')
    await expect(found.or(error)).toBeVisible({ timeout: 20_000 })
    const message = (await error.isVisible()) ? await error.textContent() : 'none'
    const matches = await page.getByText(/^Matches the/).isVisible()
    console.log(`${file}: error shown: ${message}; totals match: ${matches ? 'yes' : 'no'}; console errors: ${problems.join(' | ') || 'none'}`)
    expect(matches).toBe(true)

    // The new statement is named for its month ("July 2026"), not the file name.
    await page.getByRole('button', { name: /^Review \d+ purchases?/ }).click()
    const named = /^[A-Z][a-z]+ \d{4}$/.test((await page.getByRole('heading', { level: 1 }).textContent()) ?? '')
    console.log(`${file}: named by month: ${named ? 'yes' : 'no'}`)
    expect(named).toBe(true)
  })
}
