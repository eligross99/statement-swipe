// The onboarding tour in a real browser: real swipes and taps through all six steps, taps outside
// the step doing nothing, and the tour remembered as seen after reopening the app.
import { expect, test, type Page } from '@playwright/test'

/** Drags from the middle of `box` by (dx, dy) with a finger-like pointer, in small steps. */
async function drag(page: Page, box: { x: number; y: number; width: number; height: number }, dx: number, dy: number) {
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y + dy, { steps: 12 })
  await page.mouse.up()
}

const swipe = async (page: Page, dx: number, dy: number) =>
  drag(page, (await page.getByRole('group', { name: /^Purchase:/ }).boundingBox())!, dx, dy)

test('teaches each step in order through the real app, then remembers it was seen', async ({ page }) => {
  await page.goto('/')
  const coach = page.getByRole('complementary', { name: 'Tour' })
  const said = coach.getByRole('status')
  await expect(said).toContainText('Open the practice statement')

  // Taps outside the step do nothing.
  await page.getByRole('button', { name: 'Tasks' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Statements')
  await page.getByRole('button', { name: /^Practice statement/ }).click()

  // A swipe the tour isn't teaching yet springs back.
  await swipe(page, -200, 0)
  await expect(page.getByText('0 of 3 reviewed')).toBeVisible()
  await swipe(page, 200, 0)
  await expect(coach).toContainText('Step 2 of 6')

  // Swiping the tour card right goes back a step; left says to finish the step first.
  const card = (await coach.boundingBox())!
  await drag(page, card, -120, 0)
  await expect(said).toContainText('finish this step first')
  await drag(page, card, 160, 0)
  await expect(coach).toContainText('Step 1 of 6')
  await page.getByRole('button', { name: /^Practice statement/ }).click()
  await swipe(page, 200, 0)

  await swipe(page, -200, 0)
  await expect(page.getByRole('button', { name: /Yes, approve it/ })).toBeDisabled()
  // Scrolling away from the Flag button and touching the page leaves the page where it was: the tap
  // guide only brings a control into view once (it used to yank the page back mid-scroll).
  const look = page.locator('.overlay')
  await page.waitForTimeout(900)
  await look.evaluate((el) => (el.scrollTop = 0))
  await page.getByText('Transaction date').click()
  await page.waitForTimeout(900)
  expect(await look.evaluate((el) => el.scrollTop)).toBe(0)
  await page.getByRole('button', { name: /flag as possible fraud/ }).click()

  await expect(said).toContainText('Swipe up to file')
  await swipe(page, 0, -220)
  await page.getByRole('button', { name: 'Split with friends' }).click()

  await expect(said).toContainText('Open your folder')
  await page.getByRole('button', { name: /^Split with friends/ }).click()
  await page.getByRole('button', { name: /Change status/ }).click()
  await page.getByRole('dialog', { name: 'Set status' }).getByRole('button', { name: /^Waiting/ }).click()

  await expect(coach).toContainText('Step 5 of 6')
  await page.getByRole('button', { name: 'Back to all folders' }).click()
  await page.getByRole('button', { name: 'Back to statements' }).click()
  await page.getByRole('button', { name: 'Tasks' }).click()
  await expect(coach).toContainText('Step 6 of 6')
  await page.getByRole('button', { name: 'Statements' }).click()
  await page.getByRole('button', { name: 'Import a statement' }).click()

  // The real Import screen, with the last card; Done puts it away.
  await expect(page.getByRole('heading', { name: 'Import your statement' })).toBeVisible()
  await coach.getByRole('button', { name: 'Done' }).click()
  await expect(coach).toHaveCount(0)

  // After reopening, it doesn't start again, and nothing from practice was kept.
  await page.waitForTimeout(800)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'No statements yet' })).toBeVisible()
  await expect(coach).toHaveCount(0)
})
