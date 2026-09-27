// Synthetic statements: the tour's short practice statement, and a longer sample that the automated
// tests review. Both are made up; no real purchases.

import type { Transaction } from '../types'
import { makeId } from './format'

export const SAMPLE_LABEL = 'March 2026 sample'

const ROWS: { desc: string; amount: number; date: string; cat: string; loc?: string }[] = [
  { desc: "TRADER JOE'S #512 BOSTON MA", amount: 87.43, date: '2026-03-03', cat: 'Groceries' },
  { desc: 'SQ *DD BAR LLC 8004563', amount: 164.2, date: '2026-03-05', cat: 'Dining' },
  { desc: 'NETFLIX.COM 866-579-7', amount: 15.49, date: '2026-03-06', cat: 'Subscription' },
  { desc: 'AMZN MKTP US*RT4G9Q1', amount: 23.99, date: '2026-03-07', cat: 'Shopping' },
  { desc: 'WAYFAIR *ORDER 99120', amount: 312.0, date: '2026-03-08', cat: 'Home' },
  { desc: 'PADDLE.NET* BUNDLEXQ', amount: 89.0, date: '2026-03-09', cat: '—', loc: 'Valletta, MT' },
  { desc: 'SHELL OIL 574123900', amount: 52.3, date: '2026-03-10', cat: 'Gas' },
  { desc: 'DOORDASH*CHIPOTLE', amount: 28.44, date: '2026-03-11', cat: 'Dining' },
  { desc: 'SEPHORA #123 NEWBURY', amount: 88.0, date: '2026-03-12', cat: 'Shopping' },
  { desc: 'DIGITALOCEAN.COM', amount: 12.0, date: '2026-03-13', cat: 'Software' },
  { desc: 'UBER *EATS PENDING', amount: 34.1, date: '2026-03-14', cat: 'Dining' },
  { desc: 'SQ *THE COMEDY STUDIO', amount: 210.0, date: '2026-03-15', cat: 'Entertainment' },
  { desc: 'APLPAY 8299 GLOBAL DIGI', amount: 419.55, date: '2026-03-16', cat: '—', loc: 'Amsterdam, NL' },
  { desc: 'H MART CAMBRIDGE', amount: 41.02, date: '2026-03-17', cat: 'Groceries' },
  { desc: 'SPOTIFY USA', amount: 11.99, date: '2026-03-18', cat: 'Subscription' },
  { desc: 'CVS/PHARMACY #4021', amount: 19.87, date: '2026-03-19', cat: 'Health' },
]

/** The 16-purchase sample the tests review (no longer offered in the app; the tour replaced it). */
export function sampleTransactions(): Transaction[] {
  return ROWS.map((r) => ({
    id: makeId('t'),
    desc: r.desc,
    amount: r.amount,
    date: r.date,
    cat: r.cat,
    loc: r.loc ?? null,
    status: 'unreviewed',
    pileId: null,
    action: null,
    note: '',
  }))
}

/** The tour's practice statement: one purchase for each swipe, in the order the tour teaches them. */
export const PRACTICE_NAME = 'Practice statement'
export const PRACTICE_ID = 'practice'

const PRACTICE_ROWS: (typeof ROWS)[number][] = [
  // Swipe right: an everyday purchase anyone recognizes.
  { desc: "TRADER JOE'S #512 BOSTON MA", amount: 87.43, date: '2026-03-03', cat: 'Groceries' },
  // Swipe left: a cryptic charge from abroad, worth a closer look.
  { desc: 'APLPAY 8299 GLOBAL DIGI', amount: 419.55, date: '2026-03-05', cat: '—', loc: 'Amsterdam, NL' },
  // Swipe up: a dinner to split with friends.
  { desc: 'SQ *HARBOR TAVERN', amount: 164.2, date: '2026-03-07', cat: 'Dining' },
]

/** The practice purchases. Fixed ids are safe: the practice statement lives only inside the tour. */
export function practiceTransactions(): Transaction[] {
  return PRACTICE_ROWS.map((r, i) => ({
    id: `practice_${i + 1}`,
    desc: r.desc,
    amount: r.amount,
    date: r.date,
    cat: r.cat,
    loc: r.loc ?? null,
    status: 'unreviewed',
    pileId: null,
    action: null,
    note: '',
  }))
}

/** A folder name the tour offers as a one-tap choice when filing the dinner. */
export const PRACTICE_FOLDER = 'Split with friends'
