import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

// "Share to Statement Swipe" (Android). Android itself can't be driven from here, so this test does
// what Android does: POST the file to /share-target, which the service worker (public/share-target.js)
// answers. Then it opens the app where the service worker sends it, and checks the file shows up.

test('lists the app as a share target for statements', async ({ request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json()
  expect(manifest.share_target).toMatchObject({ action: '/share-target', method: 'POST' })
  expect(manifest.share_target.params.files[0].accept).toEqual(expect.arrayContaining(['.pdf', '.csv']))
})

test('opens a shared CSV on the Import screen', async ({ page }) => {
  await page.goto('/')
  // The service worker only handles requests once it controls the page.
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)

  const csv = readFileSync('tests/fixtures/negative-purchases.csv', 'utf8')
  const landed = await page.evaluate(async (text) => {
    const form = new FormData()
    form.append('statement', new File([text], 'Shared statement.csv', { type: 'text/csv' }))
    const res = await fetch('/share-target', { method: 'POST', body: form })
    return new URL(res.url).search
  }, csv)
  expect(landed).toBe('?shared')

  await page.goto('/?shared')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('New statement')
  await expect(page.getByText('Shared statement.csv')).toBeVisible()
  await expect(page.getByRole('button', { name: /Review \d+ purchases/ })).toBeVisible()
  // The flag is dropped, so a later reload doesn't look for the file again.
  expect(new URL(page.url()).search).toBe('')
})
