// The onboarding tour: a short, hands-on walk through the real app on a practice statement, in a
// fixed order. Six steps, each finished by doing something to the practice library (approving,
// flagging, filing, setting a status, reaching Tasks). The tour keeps a copy of the practice
// library from the start of every step, so going back a step is exact.
//
// Within a step, what the tour says and which controls work depend on what's on screen
// (`guideFor`). Controls are named by `data-tour` attributes on the elements themselves.

import type { Direction } from '../components/Deck'
import type { LibraryState } from './library'
import type { Place } from './motion'
import { PRACTICE_FOLDER } from './sample'

export const TOUR_LENGTH = 6

export interface TourState {
  /** 1 to TOUR_LENGTH. */
  step: number
  /** The practice library the app shows while the tour runs. Never saved. */
  library: LibraryState
  /** The practice library as it was at the start of each step so far (index 0 is step 1). */
  starts: LibraryState[]
}

export function newTour(library: LibraryState): TourState {
  return { step: 1, library, starts: [library] }
}

/** Whether the practice library shows that `step` has been done. Step 6 ends by leaving the tour. */
function stepDone(step: number, library: LibraryState): boolean {
  const [approve, look, file] = library.statements[0]?.session.txns ?? []
  if (!approve || !look || !file) return false
  switch (step) {
    case 1:
      return approve.status !== 'unreviewed'
    case 2:
      return look.status === 'flagged'
    case 3:
      return file.status === 'piled'
    case 4:
      return file.action === 'waiting'
    case 5:
      return library.view === 'tasks'
    default:
      return false
  }
}

/** The tour after the practice library changed: on to the next step once this one is done. */
export function withLibrary(tour: TourState, library: LibraryState): TourState {
  let { step, starts } = tour
  while (step < TOUR_LENGTH && stepDone(step, library)) {
    step++
    starts = [...starts, library]
  }
  return { step, library, starts }
}

/** Back to the start of the previous step, exactly as it was then. */
export function tourBack(tour: TourState): TourState {
  if (tour.step <= 1) return tour
  const step = tour.step - 1
  return { step, library: tour.starts[step - 1], starts: tour.starts.slice(0, step) }
}

// ---------- what the tour says and allows ----------

/** What the user can see right now. */
export interface TourScene {
  place: Place
  /** Look closer is open. */
  looking: boolean
  /** The folder sheet is open. */
  filing: boolean
}

/** Controls, named by their `data-tour` attribute. */
export type TourTarget =
  | 'open-statement'
  | 'card'
  | 'approve'
  | 'look'
  | 'file'
  | 'flag'
  | 'folder-suggestion'
  | 'folder-name'
  | 'folder-create'
  | 'open-folder'
  | 'set-status'
  | 'status-waiting'
  | 'back'
  | 'tab-tasks'
  | 'tab-statements'
  | 'import'
  | 'get-file'

export const target = (name: TourTarget) => `[data-tour="${name}"]`

/** One instruction: its words, the controls that work, and where the tap guide points. */
export interface TourLine {
  title: string
  text: string
  /** The only controls that respond. Everything else just points back to the instruction. */
  allow: TourTarget[]
  /** Where the tap guide shows, first match on screen wins (none for swipes: the card shows those). */
  point: TourTarget[]
  /** The one swipe the card accepts. */
  swipe?: Direction
}

const LINES = {
  open: {
    title: 'Open the practice statement',
    text: 'This pretend statement is for practice. Tap it to review its purchases one at a time.',
    allow: ['open-statement'],
    point: ['open-statement'],
  },
  approve: {
    title: 'Swipe right to approve',
    text: 'You know Trader Joe’s, so approve it. Tapping the Approve button works too.',
    allow: ['card', 'approve'],
    point: [],
    swipe: 'right',
  },
  look: {
    title: 'Swipe left to look closer',
    text: 'A charge you don’t recognize? See everything the statement says about it.',
    allow: ['card', 'look'],
    point: [],
    swipe: 'left',
  },
  flag: {
    title: 'Flag it as possible fraud',
    text: 'Let’s say you don’t recognize it. Flag it, and it waits in Tasks until you’ve looked into it.',
    allow: ['flag'],
    point: ['flag'],
  },
  file: {
    title: 'Swipe up to file',
    text: 'Folders hold purchases to follow up on: a bill to split, a reimbursement, taxes. This was dinner with friends.',
    allow: ['card', 'file'],
    point: [],
    swipe: 'up',
  },
  pick: {
    title: 'Pick a folder',
    text: `Tap ${PRACTICE_FOLDER}, or type a name to make your own folder.`,
    allow: ['folder-suggestion', 'folder-name', 'folder-create'],
    point: ['folder-suggestion'],
  },
  openFolder: {
    title: 'Open your folder',
    text: `Each folder keeps track of what’s left to do with its purchases. Tap ${PRACTICE_FOLDER}.`,
    allow: ['open-folder'],
    point: ['open-folder'],
  },
  status: {
    title: 'Set a status',
    text: 'Tap Set status, then Waiting: you’re waiting for your friends to pay you back.',
    allow: ['set-status', 'status-waiting'],
    point: ['status-waiting', 'set-status'],
  },
  toReview: {
    title: 'Now find it in Tasks',
    text: 'Purchases you flag or file also show up in Tasks. Tap back to return to your review.',
    allow: ['back'],
    point: ['back'],
  },
  toStatements: {
    title: 'Back to your statements',
    text: 'Tap back again. Tasks is a tab beside Statements, at the bottom of the screen.',
    allow: ['back'],
    point: ['back'],
  },
  toTasks: {
    title: 'Open Tasks',
    text: 'Tap Tasks at the bottom of the screen.',
    allow: ['tab-tasks'],
    point: ['tab-tasks'],
  },
  tasks: {
    title: 'Everything to do, in one place',
    text: 'What still needs doing, from all your statements, with possible fraud at the top. Tap Statements next.',
    allow: ['tab-statements'],
    point: ['tab-statements'],
  },
  import: {
    title: 'Add your own statement',
    text: 'Tap Import a statement. The practice statement goes away, and your real ones start here.',
    allow: ['import'],
    point: ['import'],
  },
} satisfies Record<string, TourLine>

/** After the tour, on the real Import screen: not a step, so nothing is locked. */
export const OUTRO: TourLine = {
  title: 'Your turn',
  text: 'Choose your statement’s PDF or CSV. Not sure where to find it? Tap How do I get my file?',
  allow: [],
  point: ['get-file'],
}

/** Every line the tour card can show, so it can keep one height for all of them. */
export const ALL_LINES: TourLine[] = [...Object.values(LINES), OUTRO]

/** The current instruction and how far through its step it is (0 to 1), from what's on screen. */
export function guideFor(step: number, { place, looking, filing }: TourScene): { line: TourLine; progress: number } {
  const at = (line: TourLine, progress = 0) => ({ line, progress })
  switch (step) {
    case 1:
      return place === 'deck' ? at(LINES.approve, 0.5) : at(LINES.open)
    case 2:
      return looking ? at(LINES.flag, 0.5) : at(LINES.look)
    case 3:
      return filing ? at(LINES.pick, 0.5) : at(LINES.file)
    case 4:
      return place === 'pile' ? at(LINES.status, 0.5) : at(LINES.openFolder)
    case 5:
      if (place === 'pile') return at(LINES.toReview)
      if (place === 'summary') return at(LINES.toStatements, 1 / 3)
      return at(LINES.toTasks, 2 / 3)
    default:
      return place === 'tasks' ? at(LINES.tasks) : at(LINES.import, 0.5)
  }
}
