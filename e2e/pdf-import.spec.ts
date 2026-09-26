import { expect, test } from '@playwright/test'
import { openApp } from './app.ts'

test('reads a statement PDF and starts the review', async ({ page }) => {
  await openApp(page)
  await page.getByRole('button', { name: 'Import a statement' }).click()
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/sample-statement.pdf')

  await expect(page.getByText('4 purchases found in this statement.')).toBeVisible()
  await expect(page.getByText(/^Matches the/)).toHaveText('Matches the $1,079.95 in purchases on your statement.')

  await page.getByRole('button', { name: /Review 4 purchases/ }).click()
  await expect(page.getByRole('group', { name: /^Purchase:/ })).toContainText('FAKE COFFEE CO #12 OAKLAND CA')
  // Named for the statement's closing month (07/13/2026), not the file name.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('July 2026')
})

test('explains that a scanned PDF can’t be read', async ({ page }) => {
  await openApp(page)
  await page.getByRole('button', { name: 'Import a statement' }).click()
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/scanned-statement.pdf')
  await expect(page.getByRole('alert')).toContainText('looks like a scan')
})
