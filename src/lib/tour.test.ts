import { defaultSettings, libraryReducer, practiceLibrary, type LibraryAction } from './library'
import { guideFor, newTour, TOUR_LENGTH, tourBack, withLibrary, type TourScene, type TourState } from './tour'

/** Does something in the practice library, the way the app does during the tour. */
function act(tour: TourState, action: LibraryAction): TourState {
  return withLibrary(tour, libraryReducer(tour.library, { ...action, now: 1 }))
}
const review = (event: Extract<LibraryAction, { type: 'review' }>['event']): LibraryAction => ({ type: 'review', event })

const start = () => newTour(practiceLibrary(defaultSettings, 0))
const scene = (place: TourScene['place'], extra: Partial<TourScene> = {}): TourScene => ({
  place,
  looking: false,
  filing: false,
  ...extra,
})

/** The tour taken through its first `steps` steps. */
function through(steps: number): TourState {
  const moves: LibraryAction[] = [
    { type: 'open', id: 'practice' },
    review({ type: 'approve' }),
    review({ type: 'flag' }),
    review({ type: 'createPileAndFile', pile: { id: 'f1', name: 'Split with friends' } }),
    review({ type: 'openPile', pileId: 'f1' }),
    review({ type: 'setAction', txnId: 'practice_3', action: 'waiting' }),
    { type: 'go', view: 'tasks' },
  ]
  const afterStep = [0, 2, 3, 4, 6, 7]
  return moves.slice(0, afterStep[steps]).reduce(act, start())
}

describe('the tour’s steps', () => {
  it('starts on Statements, at step 1', () => {
    const t = start()
    expect(t.step).toBe(1)
    expect(t.library.view).toBe('statements')
  })

  it('moves on as each step is done, and not before', () => {
    expect(act(start(), { type: 'open', id: 'practice' }).step).toBe(1)
    expect([1, 2, 3, 4, 5].map((n) => through(n).step)).toEqual([2, 3, 4, 5, 6])
    expect(TOUR_LENGTH).toBe(6)
  })

  it('goes back to exactly where the previous step started', () => {
    const at4 = through(3)
    expect(at4.step).toBe(4)
    const back = tourBack(at4)
    expect(back.step).toBe(3)
    // Step 3 started with the dinner not yet filed, on the deck.
    expect(back.library.statements[0].session.txns[2].status).toBe('unreviewed')
    expect(back.library.statements[0].session.screen).toBe('deck')
    // And doing it again moves on again.
    expect(act(back, review({ type: 'createPileAndFile', pile: { id: 'f1', name: 'X' } })).step).toBe(4)
  })

  it('can’t go back from the first step', () => {
    const t = start()
    expect(tourBack(t)).toBe(t)
  })
})

describe('guideFor', () => {
  it('walks step 1 from Statements into the deck', () => {
    expect(guideFor(1, scene('statements')).line.title).toBe('Open the practice statement')
    expect(guideFor(1, scene('deck')).line).toMatchObject({ title: 'Swipe right to approve', swipe: 'right' })
  })

  it('allows only flagging in Look closer, and only the folder choices while filing', () => {
    expect(guideFor(2, scene('deck', { looking: true })).line.allow).toEqual(['flag'])
    expect(guideFor(3, scene('deck', { filing: true })).line.allow).toEqual([
      'folder-suggestion',
      'folder-name',
      'folder-create',
    ])
  })

  it('reaches Tasks the real way: back, back, then the Tasks tab', () => {
    expect(guideFor(5, scene('pile')).line.point).toEqual(['back'])
    expect(guideFor(5, scene('summary')).line.point).toEqual(['back'])
    expect(guideFor(5, scene('statements')).line.point).toEqual(['tab-tasks'])
  })

  it('ends by importing a statement from Statements', () => {
    expect(guideFor(6, scene('tasks')).line.point).toEqual(['tab-statements'])
    expect(guideFor(6, scene('statements')).line.allow).toEqual(['import'])
  })

  it('fills each step’s bar as its parts are done', () => {
    expect(guideFor(4, scene('summary')).progress).toBe(0)
    expect(guideFor(4, scene('pile')).progress).toBe(0.5)
  })
})
