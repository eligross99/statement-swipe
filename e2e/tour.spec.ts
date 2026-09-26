// The onboarding tour in a real browser: real swipes on the practice statement, and the tour
// remembered as seen (and the practice statement never saved) after reopening the app.
import { expect, test, type Page } from '@playwright/test'

/** Drags the top card by (dx, dy) with a finger-like pointer, in small steps. */
async function swipe(page: Page, dx: number, dy: number) {
  const box = (await page.getByRole('group', { name: /^Purchase:/ }).boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y + dy, { steps: 12 })
  await page.mouse.up()
}

test('teaches each swipe on the practice statement, then remembers it was seen', async ({ page }) => {
  await page.goto('/')
  const coach = page.getByRole('complementary', { name: 'Tour' })
  await expect(coach).toContainText('Swipe right to approve')

  // A swipe the tour isn't teaching yet springs back.
  await swipe(page, -200, 0)
  await expect(page.getByText('0 of 3 reviewed')).toBeVisible()
  await swipe(page, 200, 0)
  await expect(page.getByText('1 of 3 reviewed')).toBeVisible()

  await expect(coach).toContainText('Swipe left to look closer')
  await swipe(page, -200, 0)
  await page.getByRole('button', { name: /flag as possible fraud/ }).click()

  await expect(coach).toContainText('Swipe up to file')
  await swipe(page, 0, -220)
  await page.getByRole('button', { name: 'Split with friends' }).click()
  await expect(coach).toContainText('Open your folder')

  // Leaving the tour here: after reopening, it doesn't start again, and nothing practice was kept.
  await coach.getByRole('button', { name: 'Skip tour' }).click()
  await expect(page.getByRole('heading', { name: 'No statements yet' })).toBeVisible()
  await page.waitForTimeout(800)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'No statements yet' })).toBeVisible()
  await expect(coach).toHaveCount(0)

  // Replaying from Settings starts it over.
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Replay the tour' }).click()
  await expect(coach).toContainText('Step 1 of 5')
})
