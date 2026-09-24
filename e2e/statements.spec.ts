/// <reference lib="dom" />
// (The line above: code inside page.evaluate() runs in the browser, so it uses browser types.)
// Saving statements in the browser's real database (IndexedDB, through Dexie), which the unit
// tests can't reach: surviving a reload, deleting, and moving a review saved by an older version.
import { expect, test, type Page } from '@playwright/test'

/** Lets the app's short save delay pass, then reloads, like closing and reopening the app. */
async function reopen(page: Page) {
  await page.waitForTimeout(800)
  await page.reload()
}

test('keeps statements across a reload, and deletes one after asking', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'No statements yet' })).toBeVisible()
  await page.getByRole('button', { name: 'Import a statement' }).click()
  await page.getByRole('button', { name: /Try the sample statement/ }).click()
  await page.getByRole('button', { name: 'Approve' }).click()
  await expect(page.getByText('1 of 16 reviewed')).toBeVisible()

  // Reopening returns to the review, where it was left.
  await reopen(page)
  await expect(page.getByText('1 of 16 reviewed')).toBeVisible()

  await page.getByRole('button', { name: 'Back to statements' }).click()
  await expect(page.getByText('In progress, 15 of 16 left')).toBeVisible()
  await reopen(page)
  await expect(page.getByText('In progress, 15 of 16 left')).toBeVisible()

  await page.getByRole('button', { name: 'More for March 2026 sample' }).click()
  await page.getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('button', { name: 'Delete statement' }).click()
  await expect(page.getByRole('heading', { name: 'No statements yet' })).toBeVisible()
  await reopen(page)
  await expect(page.getByRole('heading', { name: 'No statements yet' })).toBeVisible()
})

test('moves a review saved before multiple statements into the list, keeping undo', async ({ page }) => {
  await page.goto('/')
  // Write the old single saved review exactly as the previous version did (idb-keyval's database).
  await page.evaluate(async () => {
    const t = (id: string, desc: string, date: string, status: string) => ({
      id,
      desc,
      amount: 10,
      date,
      cat: '—',
      status,
      pileId: null,
      action: null,
      note: '',
    })
    const session = {
      txns: [t('a', 'FIRST SHOP', '2026-06-20', 'approved'), t('b', 'SECOND SHOP', '2026-07-02', 'unreviewed')],
      index: 1,
      piles: [],
      screen: 'deck',
      label: 'eStmt_2026-07-13',
      openPile: null,
    }
    const undo = [{ txnId: 'a', index: 0, status: 'unreviewed', pileId: null }]
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('keyval-store')
      open.onupgradeneeded = () => open.result.createObjectStore('keyval')
      open.onsuccess = () => {
        const tx = open.result.transaction('keyval', 'readwrite')
        tx.objectStore('keyval').put(session, 'statement-swipe-session-v1')
        tx.objectStore('keyval').put(undo, 'statement-swipe-undo-v1')
        tx.oncomplete = () => {
          open.result.close()
          resolve()
        }
        tx.onerror = () => reject(tx.error)
      }
    })
  })
  await page.reload()

  // It reopens where the user was, named for its month, with undo still working.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('July 2026')
  await expect(page.getByText('1 of 2 reviewed')).toBeVisible()
  await page.getByRole('button', { name: 'Undo last action' }).click()
  await expect(page.getByText('0 of 2 reviewed')).toBeVisible()

  // Moved only once: after reopening there's still one statement.
  await reopen(page)
  await page.getByRole('button', { name: 'Back to statements' }).click()
  await expect(page.getByRole('button', { name: /^More for/ })).toHaveCount(1)
})
