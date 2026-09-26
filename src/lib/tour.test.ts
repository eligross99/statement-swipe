import type { Action, Statement, Status } from '../types'
import { makeStatement } from './library'
import { practiceTransactions } from './sample'
import { coachFor, TOUR_LENGTH, TOUR_SWIPE, tourStep, type TourScene } from './tour'

/** The practice statement with its three purchases set to these statuses (and the filed one's action). */
function practice(statuses: Status[], action: Action = null): Statement {
  const st = makeStatement(practiceTransactions(), { id: 'practice', name: 'Practice statement', period: null, now: 0 })
  const txns = st.session.txns.map((t, i) => ({ ...t, status: statuses[i], action: statuses[i] === 'piled' ? action : null }))
  return { ...st, session: { ...st.session, txns } }
}

const deck: TourScene = { place: 'deck', looking: false, filing: false }

describe('tourStep', () => {
  it('follows what’s been done to the practice statement', () => {
    expect(tourStep(practice(['unreviewed', 'unreviewed', 'unreviewed']))).toBe('approve')
    expect(tourStep(practice(['approved', 'unreviewed', 'unreviewed']))).toBe('look')
    expect(tourStep(practice(['approved', 'flagged', 'unreviewed']))).toBe('file')
    expect(tourStep(practice(['approved', 'flagged', 'piled']))).toBe('status')
    expect(tourStep(practice(['approved', 'flagged', 'piled'], 'waiting'))).toBe('tasks')
  })

  it('moves on without a status if the folder was deleted, or the statement is gone', () => {
    // Deleting a folder moves its purchases to Approved.
    expect(tourStep(practice(['approved', 'flagged', 'approved']))).toBe('tasks')
    expect(tourStep(undefined)).toBe('tasks')
  })
})

describe('coachFor', () => {
  it('numbers the steps out of the tour’s length', () => {
    expect(coachFor('approve', deck).number).toBe(1)
    expect(coachFor('tasks', { ...deck, place: 'tasks' }).number).toBe(TOUR_LENGTH)
  })

  it('teaches one swipe per card', () => {
    expect(TOUR_SWIPE).toEqual({ approve: 'right', look: 'left', file: 'up' })
    expect(coachFor('look', deck).title).toBe('Swipe left to look closer')
    expect(coachFor('file', deck).title).toBe('Swipe up to file')
  })

  it('changes its words with what’s on screen', () => {
    expect(coachFor('look', { ...deck, looking: true }).title).toBe('Do you recognize it?')
    expect(coachFor('file', { ...deck, filing: true }).text).toContain('Split with friends')
    expect(coachFor('status', { ...deck, place: 'summary' }).title).toBe('Open your folder')
    expect(coachFor('status', { ...deck, place: 'pile' }).title).toBe('Set a status')
  })

  it('points back to the practice statement when the user wanders off mid-review', () => {
    expect(coachFor('look', { ...deck, place: 'statements' }).title).toBe('Open the practice statement')
    expect(coachFor('look', { ...deck, place: 'statements' }).number).toBe(2)
  })

  it('offers a button to see Tasks, then one to finish', () => {
    expect(coachFor('tasks', { ...deck, place: 'pile' }).next).toEqual({ label: 'Show me Tasks', go: 'tasks' })
    expect(coachFor('tasks', { ...deck, place: 'tasks' }).next).toEqual({ label: 'Get your statement', go: 'finish' })
    expect(coachFor('tasks', { ...deck, place: 'statements' }).next?.go).toBe('tasks')
  })
})
