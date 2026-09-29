// A tester's first minutes (Phase 7c): the launch screen, and the Home Screen hint on iPhone Safari.
import { expect, test } from '@playwright/test'
import { openApp } from './app.ts'

test('shows only the logo while loading, then fades it away', async ({ page }) => {
  await page.goto('/')
  // The logo is in the page itself, so it's there before the app's code runs, with no words.
  await expect(page.locator('#splash svg')).toHaveCount(1)
  await expect(page.locator('#splash')).toHaveText('')
  await expect(page.getByRole('button', { name: 'Skip tour' })).toBeVisible()
  await expect(page.locator('#splash')).toHaveCount(0)
})

test('suggests adding the app to the Home Screen until the user says Not now', async ({ page }) => {
  await openApp(page)
  const hint = page.getByRole('heading', { name: 'Add Swipe to your Home Screen' })
  await expect(hint).toBeVisible()

  await page.getByRole('button', { name: 'Show me how' }).click()
  await expect(page.getByRole('dialog', { name: 'Add to your Home Screen' })).toContainText('Add to Home Screen')
  await page.getByRole('button', { name: 'Got it' }).click()

  await page.getByRole('button', { name: 'Not now' }).click()
  await expect(hint).toHaveCount(0)
  await page.waitForTimeout(800) // the app's short save delay
  await page.reload()
  await expect(page.getByRole('heading', { name: 'No statements yet' })).toBeVisible()
  await expect(hint).toHaveCount(0)
  // The steps stay in Settings.
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('button', { name: 'Add to Home Screen' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Send feedback' })).toHaveAttribute('href', /^mailto:/)
})
