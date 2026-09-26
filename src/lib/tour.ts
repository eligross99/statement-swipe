// The onboarding tour: a short, hands-on walk through the app on a practice statement (see
// `practiceLibrary` in library.ts). Which step the user is on is worked out from the practice
// statement itself, never stored, so undo, Back, or starting over simply move the tour with them.

import type { Direction } from '../components/Deck'
import type { Place } from './motion'
import { PRACTICE_FOLDER } from './sample'
import type { Statement } from '../types'

/** The tour's steps, in order: one per thing the user tries. */
export type TourStep = 'approve' | 'look' | 'file' | 'status' | 'tasks'

const STEPS: TourStep[] = ['approve', 'look', 'file', 'status', 'tasks']
export const TOUR_LENGTH = STEPS.length

/** Where the user is in the tour, from what they've done to the practice statement so far. */
export function tourStep(practice: Statement | undefined): TourStep {
  const [approve, look, file] = practice?.session.txns ?? []
  // Missing (e.g. deleted from Statements): nothing left to practice on, so offer the last step.
  if (!approve || !look || !file) return 'tasks'
  if (approve.status === 'unreviewed') return 'approve'
  if (look.status === 'unreviewed') return 'look'
  if (file.status === 'unreviewed') return 'file'
  if (file.status === 'piled' && file.action === null) return 'status'
  return 'tasks'
}

/** The one swipe the deck accepts on each swiping step, so each card teaches one gesture. */
export const TOUR_SWIPE: Partial<Record<TourStep, Direction>> = { approve: 'right', look: 'left', file: 'up' }

/** What the user can see right now, which decides the tour's wording. */
export interface TourScene {
  place: Place
  /** Look closer is open. */
  looking: boolean
  /** The folder sheet is open. */
  filing: boolean
}

/** What the tour card says: the step number, a short instruction, and a line of why. */
export interface Coach {
  /** 1-based, out of TOUR_LENGTH. */
  number: number
  title: string
  text: string
  /** A button for steps that move on by tapping rather than doing: see Tasks, or finish. */
  next?: { label: string; go: 'tasks' | 'finish' }
}

/** The tour card's words for a step, adjusted to what's on screen. */
export function coachFor(step: TourStep, { place, looking, filing }: TourScene): Coach {
  const number = STEPS.indexOf(step) + 1
  const say = (title: string, text: string, next?: Coach['next']): Coach => ({ number, title, text, next })

  // Wandered off to the Statements or Tasks tab before the review is done.
  const away = place === 'statements' || place === 'tasks'
  if (away && step !== 'tasks') {
    return say('Open the practice statement', 'Tap Practice statement on the Statements tab to carry on.')
  }

  switch (step) {
    case 'approve':
      return say(
        'Swipe right to approve',
        'This is a practice statement. You know Trader Joe’s, so approve it. Tapping Approve works too.',
      )
    case 'look':
      if (looking)
        return say(
          'Do you recognize it?',
          'Let’s say you don’t. Flag it as possible fraud, and it waits in Tasks until you’ve looked into it.',
        )
      return say('Swipe left to look closer', 'A charge you don’t recognize? See everything the statement says about it.')
    case 'file':
      if (filing) return say('Pick a folder', `Tap ${PRACTICE_FOLDER}, or name your own.`)
      return say('Swipe up to file', 'Dinner with friends? File it in a folder, so you remember to split the bill.')
    case 'status':
      if (place === 'pile')
        return say('Set a status', 'Tap Set status and choose Waiting, as if your friends still owe you.')
      return say('Open your folder', 'Review done! Tap the folder you just made to see what’s inside.')
    case 'tasks':
      if (place === 'tasks')
        return say(
          'Everything to do, in one place',
          'Tasks gathers what’s left from every statement, possible fraud first. Now, your own statement.',
          { label: 'Get your statement', go: 'finish' },
        )
      return say('Nicely done', 'Purchases you flag or file also show up in Tasks, so nothing slips.', {
        label: 'Show me Tasks',
        go: 'tasks',
      })
  }
}
