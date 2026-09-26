// The Tasks tab in a real browser: tasks come from a real review, statuses set there are saved,
// and the app reopens on the tab the user was last on.
import { expect, test, type Page } from '@playwright/test'
import { reviewSample } from './app.ts'

/** Lets the app's short save delay pass, then reloads, like closing and reopening the app. */
async function reopen(page: Page) {
  await page.waitForTimeout(800)
  await page.reload()
}

test('tracks flagged and filed purchases from a review through to done', async ({ page }) => {
  await reviewSample(page)

  // Flag the first card, file the second, and leave the rest for later.
  await page.getByRole('button', { name: 'Look closer' }).click()
  await page.getByRole('button', { name: /flag as possible fraud/ }).click()
  await expect(page.getByText('1 of 16 reviewed')).toBeVisible()
  await page.getByRole('button', { name: 'File' }).click()
  await page.getByRole('textbox', { name: 'New folder name' }).fill('Split')
  await page.keyboard.press('Enter')
  await expect(page.getByText('2 of 16 reviewed')).toBeVisible()

  // Tasks shows both, even though the review isn't finished.
  await page.getByRole('button', { name: 'Back to statements' }).click()
  await page.getByRole('button', { name: /^Tasks/ }).click()
  // Grouped by status, possible fraud first.
  const todo = page.getByRole('region', { name: /To do/ })
  await expect(todo.getByRole('listitem').first()).toContainText("TRADER JOE'S #512 BOSTON MA")
  await expect(todo.getByRole('listitem').first()).toContainText('Possible fraud')
  await expect(todo.getByText('SQ *DD BAR LLC 8004563')).toBeVisible()

  // Resolve the flag from the Tasks list.
  await page.getByRole('button', { name: /Change status for TRADER JOE'S/ }).click()
  await page.getByRole('dialog', { name: 'Set status' }).getByRole('button', { name: /^Done/ }).click()
  await expect(page.getByRole('region', { name: /Done/ }).getByText("TRADER JOE'S #512 BOSTON MA")).toBeVisible()
  await expect(todo.getByRole('listitem')).toHaveCount(1)

  // Saved, and the app reopens on Tasks.
  await reopen(page)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tasks')
  await expect(page.getByRole('region', { name: /Done/ }).getByText("TRADER JOE'S #512 BOSTON MA")).toBeVisible()

  // A filed purchase opens in its folder, from a tap anywhere on its card; Back returns to Tasks.
  await todo.getByRole('listitem').first().click({ position: { x: 300, y: 100 } })
  await expect(page.getByRole('heading', { level: 2, name: 'Split' })).toBeVisible()
  await page.getByRole('button', { name: 'Back to tasks' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tasks')
})
