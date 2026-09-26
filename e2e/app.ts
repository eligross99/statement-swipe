// Shared starting points for the end-to-end tests.
import { expect, type Page } from '@playwright/test'

/** Opens the app as a new user and skips the tour, landing on the empty Statements screen. */
export async function openApp(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Skip tour' }).click()
  await expect(page.getByRole('heading', { name: 'No statements yet' })).toBeVisible()
}

/** Opens the app and starts reviewing a synthetic 16-purchase statement (tests/fixtures/sample-march.csv). */
export async function reviewSample(page: Page) {
  await openApp(page)
  await page.getByRole('button', { name: 'Import a statement' }).click()
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/sample-march.csv')
  await page.getByRole('button', { name: /Review 16 purchases/ }).click()
  await expect(page.getByText('0 of 16 reviewed')).toBeVisible()
}
