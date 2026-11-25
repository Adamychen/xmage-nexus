import { describe, expect, it } from 'vitest'
import { createLibraryPlan, nextPlanAnswer, type LibraryArrangement } from './libraryPlan'
import type { FeedbackPrompt, LibraryStep } from './types'

const GAME = 'game-1'
const CARDS = ['a', 'b', 'c']

function shown(ids: string[]): FeedbackPrompt['cards'] {
  return ids.map((id) => ({ id, name: id })) as FeedbackPrompt['cards']
}

function prompt(libraryStep: LibraryStep | undefined, extra: Partial<FeedbackPrompt> = {}): FeedbackPrompt {
  const isAsk = libraryStep === 'grave-order-ask'
  const isPick = libraryStep === 'surveil-pick' || libraryStep === 'scry-pick'
  return {
    method: isAsk ? 'GAME_ASK' : 'GAME_TARGET',
    gameId: GAME,
    title: '',
    message: '',
    mode: isAsk ? 'boolean' : 'uuid',
    options: isPick ? offered(CARDS) : [],
    min: 0,
    max: 3,
    libraryStep,
    ...(isPick ? { cards: shown(CARDS) } : {}),
    ...extra,
  }
}

function offered(ids: string[]): FeedbackPrompt['options'] {
  return ids.map((id) => ({ id, label: id, value: id }))
}

function plan(arrangement: LibraryArrangement, cardIds: string[] = CARDS) {
  return createLibraryPlan(GAME, cardIds, arrangement)
}

describe('libraryPlan', () => {
  it('PRM-20: the surveil pick answers each graveyard card, then Done', () => {
    const p = plan({ mode: 'surveil', top: ['a'], away: ['b', 'c'] })
    expect(nextPlanAnswer(p, prompt('surveil-pick', { chosenTargets: [] }))?.answer).toEqual({ kind: 'uuid', value: 'b' })
    expect(nextPlanAnswer(p, prompt('surveil-pick', { chosenTargets: ['b'] }))?.answer).toEqual({ kind: 'uuid', value: 'c' })
    expect(nextPlanAnswer(p, prompt('surveil-pick', { chosenTargets: ['b', 'c'] }))?.answer).toEqual({ kind: 'boolean', value: false })
  })

  it('PRM-20: the pick step reads chosenTargets, not a counter', () => {
    const p = plan({ mode: 'surveil', top: ['a'], away: ['b', 'c'] })
    expect(nextPlanAnswer(p, prompt('surveil-pick', { chosenTargets: ['c'] }))?.answer).toEqual({ kind: 'uuid', value: 'b' })
  })

  it('PRM-20: a pick prompt holding a card the plan keeps on top is not the plan', () => {
    const p = plan({ mode: 'surveil', top: ['a'], away: ['b', 'c'] })
    expect(nextPlanAnswer(p, prompt('surveil-pick', { chosenTargets: ['a'] }))).toBeNull()
  })

  it('PRM-20: the top order picks the bottom card first so the leftmost ends on top', () => {
    const p = plan({ mode: 'surveil', top: ['a', 'b', 'c'], away: [] })
    expect(nextPlanAnswer(p, prompt('top-order', { options: offered(['a', 'b', 'c']) }))?.answer).toEqual({ kind: 'uuid', value: 'c' })
    expect(nextPlanAnswer(p, prompt('top-order', { options: offered(['a', 'b']) }))?.answer).toEqual({ kind: 'uuid', value: 'b' })
    expect(nextPlanAnswer(p, prompt('top-order', { options: offered(['a', 'x']) }))).toBeNull()
  })

  it('PRM-20: the scry bottom order picks left to right so the rightmost ends bottommost', () => {
    const p = plan({ mode: 'scry', top: ['a'], away: ['b', 'c'] })
    expect(nextPlanAnswer(p, prompt('bottom-order', { options: offered(['b', 'c']) }))?.answer).toEqual({ kind: 'uuid', value: 'b' })
  })

  it('PRM-20: the graveyard order is asked for and puts the rightmost card on top', () => {
    const p = plan({ mode: 'surveil', top: ['a'], away: ['b', 'c'] })
    expect(nextPlanAnswer(p, prompt('grave-order', { options: offered(['b', 'c']) }))?.answer).toEqual({ kind: 'uuid', value: 'b' })
    expect(nextPlanAnswer(p, prompt('grave-order-ask'))?.answer).toEqual({ kind: 'boolean', value: true })
    const single = plan({ mode: 'surveil', top: ['a', 'b'], away: ['c'] })
    expect(nextPlanAnswer(single, prompt('grave-order-ask'))).toBeNull()
  })

  it('PRM-20: a single card ends the chain at the pick step', () => {
    const one = { max: 1, chosenTargets: [], options: offered(['a']), cards: shown(['a']) }
    const kept = plan({ mode: 'surveil', top: ['a'], away: [] }, ['a'])
    const done = nextPlanAnswer(kept, prompt('surveil-pick', one))
    expect(done?.answer).toEqual({ kind: 'boolean', value: false })
    expect(done?.plan.settled).toBe(true)
    const binned = plan({ mode: 'surveil', top: [], away: ['a'] }, ['a'])
    const pick = nextPlanAnswer(binned, prompt('surveil-pick', one))
    expect(pick?.answer).toEqual({ kind: 'uuid', value: 'a' })
    expect(pick?.plan.settled).toBe(true)
  })

  it('PRM-20: a scry settles after its last bottom pick, a surveil at its last pick answer', () => {
    const scry = plan({ mode: 'scry', top: ['a'], away: ['b', 'c'] })
    expect(nextPlanAnswer(scry, prompt('bottom-order', { options: offered(['b', 'c']) }))?.plan.settled).toBe(true)
    expect(nextPlanAnswer(scry, prompt('scry-pick', { chosenTargets: ['b', 'c'] }))?.plan.settled).toBe(false)
    const surveil = plan({ mode: 'surveil', top: ['a'], away: ['b', 'c'] })
    const done = nextPlanAnswer(surveil, prompt('surveil-pick', { chosenTargets: ['b', 'c'] }))
    expect(done?.answer).toEqual({ kind: 'boolean', value: false })
    expect(done?.plan.settled).toBe(true)
    const binned = plan({ mode: 'surveil', top: [], away: ['a', 'b', 'c'] })
    const last = nextPlanAnswer(binned, prompt('surveil-pick', { chosenTargets: ['a', 'b'] }))
    expect(last?.answer).toEqual({ kind: 'uuid', value: 'c' })
    expect(last?.plan.settled).toBe(true)
    const kept = plan({ mode: 'surveil', top: ['a', 'b'], away: ['c'] })
    expect(nextPlanAnswer(kept, prompt('surveil-pick', { chosenTargets: ['c'] }))?.plan.settled).toBe(false)
  })

  it('PRM-20: a pick over other cards is not the plan', () => {
    const p = plan({ mode: 'surveil', top: ['a'], away: ['b', 'c'] })
    const later = { cards: shown(['x', 'y', 'z']), options: offered(['x', 'y', 'z']), chosenTargets: [] }
    expect(nextPlanAnswer(p, prompt('surveil-pick', later))).toBeNull()
    expect(nextPlanAnswer(p, prompt('surveil-pick', { cards: shown(['a', 'b']), chosenTargets: [] }))).toBeNull()
    expect(nextPlanAnswer(p, prompt('surveil-pick', { cards: shown(['a', 'b', 'c', 'x']), chosenTargets: [] }))).toBeNull()
    expect(nextPlanAnswer(p, prompt('surveil-pick', { options: offered(['a', 'c']), chosenTargets: [] }))).toBeNull()
    expect(nextPlanAnswer(p, prompt('surveil-pick', { cards: shown(['c', 'b', 'a']), chosenTargets: [] }))?.answer).toEqual({ kind: 'uuid', value: 'b' })
  })

  it('PRM-20: an order over cards outside the plan is not the plan', () => {
    const p = plan({ mode: 'surveil', top: ['a', 'b'], away: ['c'] })
    expect(nextPlanAnswer(p, prompt('top-order', { options: offered(['a', 'b', 'x']) }))).toBeNull()
  })

  it('PRM-20: the last top order pick settles the plan', () => {
    const p = plan({ mode: 'surveil', top: ['a', 'b', 'c'], away: [] })
    const first = nextPlanAnswer(p, prompt('top-order', { options: offered(['a', 'b', 'c']) }))
    expect(first?.plan.settled).toBe(false)
    expect(nextPlanAnswer(p, prompt('top-order', { options: offered(['a', 'b']) }))?.plan.settled).toBe(true)
  })

  it('PRM-20: a prompt that is not this chain gets no answer', () => {
    const p = plan({ mode: 'surveil', top: ['a'], away: ['b', 'c'] })
    expect(nextPlanAnswer(p, prompt(undefined, { chosenTargets: [] }))).toBeNull()
    expect(nextPlanAnswer(p, prompt('scry-pick', { chosenTargets: [] }))).toBeNull()
    expect(nextPlanAnswer(p, prompt('surveil-pick', { gameId: 'game-2', chosenTargets: [] }))).toBeNull()
  })

  it('PRM-20: answering never mutates the plan it was given', () => {
    const p = plan({ mode: 'surveil', top: ['a', 'b'], away: [] })
    const snapshot = structuredClone(p)
    const next = nextPlanAnswer(p, prompt('top-order', { options: offered(['a', 'b']) }))
    expect(next?.plan.settled).toBe(true)
    expect(next?.plan).not.toBe(p)
    expect(p).toEqual(snapshot)
  })

  it('PRM-20: standalone top-order chains bottom-to-top and settles on the last pick', () => {
    const p = plan({ mode: 'top-order', top: ['a', 'b', 'c'], away: [] })
    const first = nextPlanAnswer(p, prompt('top-order', { options: offered(['a', 'b', 'c']) }))
    expect(first?.answer).toEqual({ kind: 'uuid', value: 'c' })
    expect(first?.plan.settled).toBe(false)
    const second = nextPlanAnswer(first!.plan, prompt('top-order', { options: offered(['a', 'b']) }))
    expect(second?.answer).toEqual({ kind: 'uuid', value: 'b' })
    expect(second?.plan.settled).toBe(true)
    expect(nextPlanAnswer(p, prompt('bottom-order', { options: offered(['a', 'b']) }))).toBeNull()
  })

  it('PRM-20: standalone bottom-order chains closest-to-top first so the last lands bottommost', () => {
    const p = plan({ mode: 'bottom-order', top: [], away: ['c', 'b', 'a'] })
    const first = nextPlanAnswer(p, prompt('bottom-order', { options: offered(['a', 'b', 'c']) }))
    expect(first?.answer).toEqual({ kind: 'uuid', value: 'c' })
    expect(first?.plan.settled).toBe(false)
    const second = nextPlanAnswer(first!.plan, prompt('bottom-order', { options: offered(['a', 'b']) }))
    expect(second?.answer).toEqual({ kind: 'uuid', value: 'b' })
    expect(second?.plan.settled).toBe(true)
    expect(nextPlanAnswer(p, prompt('top-order', { options: offered(['a', 'b']) }))).toBeNull()
  })

  it('PRM-20: standalone grave-order chains bottom-to-top and settles on the last pick', () => {
    const p = plan({ mode: 'grave-order', top: [], away: ['c', 'b', 'a'] })
    const first = nextPlanAnswer(p, prompt('grave-order', { options: offered(['a', 'b', 'c']) }))
    expect(first?.answer).toEqual({ kind: 'uuid', value: 'c' })
    expect(first?.plan.settled).toBe(false)
    const second = nextPlanAnswer(first!.plan, prompt('grave-order', { options: offered(['a', 'b']) }))
    expect(second?.answer).toEqual({ kind: 'uuid', value: 'b' })
    expect(second?.plan.settled).toBe(true)
  })

  describe('PRM-6: a multi-card target pick (Kodama\'s Reach)', () => {
    const grid = (chosenTargets: string[], extra: Partial<FeedbackPrompt> = {}): FeedbackPrompt => ({
      method: 'GAME_TARGET',
      gameId: GAME,
      title: '',
      message: `Select basic land cards (selected ${chosenTargets.length} of 2)`,
      mode: 'uuid',
      options: offered(CARDS.filter((id) => !chosenTargets.includes(id))),
      min: 0,
      max: 0,
      cards: shown(CARDS),
      chosenTargets,
      progress: { selected: chosenTargets.length, max: 2 },
      ...extra,
    })

    it('PRM-6: answers each chosen card on its own re-ask and settles on the card that fills the pick', () => {
      let p = plan({ mode: 'pick', top: [], away: ['c', 'a'] })
      const first = nextPlanAnswer(p, grid([]))!
      expect(first.answer).toEqual({ kind: 'uuid', value: 'c' })
      expect(first.plan.settled).toBe(false)
      p = first.plan
      const second = nextPlanAnswer(p, grid(['c']))!
      expect(second.answer).toEqual({ kind: 'uuid', value: 'a' })
      expect(second.plan.settled).toBe(true)
    })

    it('PRM-6: fewer cards than the most allowed end with Done', () => {
      const p = plan({ mode: 'pick', top: [], away: ['b'] })
      const first = nextPlanAnswer(p, grid([]))!
      expect(first.answer).toEqual({ kind: 'uuid', value: 'b' })
      expect(first.plan.settled).toBe(false)
      const done = nextPlanAnswer(first.plan, grid(['b']))!
      expect(done.answer).toEqual({ kind: 'boolean', value: false })
      expect(done.plan.settled).toBe(false)
      const again = nextPlanAnswer(done.plan, grid(['b']))!
      expect(again.answer, 'a library search asks for Done a second time').toEqual({ kind: 'boolean', value: false })
      expect(again.plan.settled).toBe(true)
      expect(nextPlanAnswer(again.plan, grid(['b'])), 'never a third time').toBeNull()
    })

    it('PRM-6: the next prompt of the spell (another pick over other cards) is not the plan', () => {
      const p = plan({ mode: 'pick', top: [], away: ['a', 'b'] })
      const after = grid([], { message: 'Select a card to put on the battlefield tapped', cards: shown(['a', 'b']), options: offered(['a', 'b']), progress: undefined })
      expect(nextPlanAnswer(p, after)).toBeNull()
    })

    it('PRM-6: a library chain prompt or a card the prompt does not offer is not the plan', () => {
      const p = plan({ mode: 'pick', top: [], away: ['a', 'b'] })
      expect(nextPlanAnswer(p, grid([], { libraryStep: 'scry-pick' }))).toBeNull()
      expect(nextPlanAnswer(p, grid([], { options: offered(['b', 'c']) }))).toBeNull()
    })
  })
})
