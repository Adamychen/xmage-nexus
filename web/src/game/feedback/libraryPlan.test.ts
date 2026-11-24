import { describe, expect, it } from 'vitest'
import { createLibraryPlan, nextPlanAnswer, type LibraryArrangement } from './libraryPlan'
import type { FeedbackPrompt, LibraryStep } from './types'

const GAME = 'game-1'
const CARDS = ['a', 'b', 'c']

function prompt(libraryStep: LibraryStep | undefined, extra: Partial<FeedbackPrompt> = {}): FeedbackPrompt {
  const isAsk = libraryStep === 'grave-order-ask'
  return {
    method: isAsk ? 'GAME_ASK' : 'GAME_TARGET',
    gameId: GAME,
    title: '',
    message: '',
    mode: isAsk ? 'boolean' : 'uuid',
    options: [],
    min: 0,
    max: 3,
    libraryStep,
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
  it('PRM-18: the surveil pick answers each graveyard card, then Done', () => {
    const p = plan({ mode: 'surveil', top: ['a'], away: ['b', 'c'] })
    expect(nextPlanAnswer(p, prompt('surveil-pick', { chosenTargets: [] }))?.answer).toEqual({ kind: 'uuid', value: 'b' })
    expect(nextPlanAnswer(p, prompt('surveil-pick', { chosenTargets: ['b'] }))?.answer).toEqual({ kind: 'uuid', value: 'c' })
    expect(nextPlanAnswer(p, prompt('surveil-pick', { chosenTargets: ['b', 'c'] }))?.answer).toEqual({ kind: 'boolean', value: false })
  })

  it('PRM-18: the pick step reads chosenTargets, not a counter', () => {
    const p = plan({ mode: 'surveil', top: ['a'], away: ['b', 'c'] })
    expect(nextPlanAnswer(p, prompt('surveil-pick', { chosenTargets: ['c'] }))?.answer).toEqual({ kind: 'uuid', value: 'b' })
  })

  it('PRM-18: a pick prompt holding a card the plan keeps on top is not the plan', () => {
    const p = plan({ mode: 'surveil', top: ['a'], away: ['b', 'c'] })
    expect(nextPlanAnswer(p, prompt('surveil-pick', { chosenTargets: ['a'] }))).toBeNull()
  })

  it('PRM-18: the top order picks the bottom card first so the leftmost ends on top', () => {
    const p = plan({ mode: 'surveil', top: ['a', 'b', 'c'], away: [] })
    expect(nextPlanAnswer(p, prompt('top-order', { options: offered(['a', 'b', 'c']) }))?.answer).toEqual({ kind: 'uuid', value: 'c' })
    expect(nextPlanAnswer(p, prompt('top-order', { options: offered(['a', 'b']) }))?.answer).toEqual({ kind: 'uuid', value: 'b' })
    expect(nextPlanAnswer(p, prompt('top-order', { options: offered(['a', 'x']) }))).toBeNull()
  })

  it('PRM-18: the scry bottom order picks left to right so the rightmost ends bottommost', () => {
    const p = plan({ mode: 'scry', top: ['a'], away: ['b', 'c'] })
    expect(nextPlanAnswer(p, prompt('bottom-order', { options: offered(['b', 'c']) }))?.answer).toEqual({ kind: 'uuid', value: 'b' })
  })

  it('PRM-18: the graveyard order is asked for and puts the rightmost card on top', () => {
    const p = plan({ mode: 'surveil', top: ['a'], away: ['b', 'c'] })
    expect(nextPlanAnswer(p, prompt('grave-order', { options: offered(['b', 'c']) }))?.answer).toEqual({ kind: 'uuid', value: 'b' })
    expect(nextPlanAnswer(p, prompt('grave-order-ask'))?.answer).toEqual({ kind: 'boolean', value: true })
    const single = plan({ mode: 'surveil', top: ['a', 'b'], away: ['c'] })
    expect(nextPlanAnswer(single, prompt('grave-order-ask'))).toBeNull()
  })

  it('PRM-18: a single card ends the chain at the pick step', () => {
    const kept = plan({ mode: 'surveil', top: ['a'], away: [] }, ['a'])
    const done = nextPlanAnswer(kept, prompt('surveil-pick', { max: 1, chosenTargets: [] }))
    expect(done?.answer).toEqual({ kind: 'boolean', value: false })
    expect(done?.plan.settled).toBe(true)
    const binned = plan({ mode: 'surveil', top: [], away: ['a'] }, ['a'])
    const pick = nextPlanAnswer(binned, prompt('surveil-pick', { max: 1, chosenTargets: [] }))
    expect(pick?.answer).toEqual({ kind: 'uuid', value: 'a' })
    expect(pick?.plan.settled).toBe(true)
  })

  it('PRM-18: a scry settles after its last bottom pick, a surveil waits for a possible graveyard order', () => {
    const scry = plan({ mode: 'scry', top: ['a'], away: ['b', 'c'] })
    expect(nextPlanAnswer(scry, prompt('bottom-order', { options: offered(['b', 'c']) }))?.plan.settled).toBe(true)
    const surveil = plan({ mode: 'surveil', top: ['a'], away: ['b', 'c'] })
    const done = nextPlanAnswer(surveil, prompt('surveil-pick', { chosenTargets: ['b', 'c'] }))
    expect(done?.answer).toEqual({ kind: 'boolean', value: false })
    expect(done?.plan.settled).toBe(false)
  })

  it('PRM-18: the last top order pick settles the plan', () => {
    const p = plan({ mode: 'surveil', top: ['a', 'b', 'c'], away: [] })
    const first = nextPlanAnswer(p, prompt('top-order', { options: offered(['a', 'b', 'c']) }))
    expect(first?.plan.settled).toBe(false)
    expect(nextPlanAnswer(p, prompt('top-order', { options: offered(['a', 'b']) }))?.plan.settled).toBe(true)
  })

  it('PRM-18: a prompt that is not this chain gets no answer', () => {
    const p = plan({ mode: 'surveil', top: ['a'], away: ['b', 'c'] })
    expect(nextPlanAnswer(p, prompt(undefined, { chosenTargets: [] }))).toBeNull()
    expect(nextPlanAnswer(p, prompt('scry-pick', { chosenTargets: [] }))).toBeNull()
    expect(nextPlanAnswer(p, prompt('surveil-pick', { gameId: 'game-2', chosenTargets: [] }))).toBeNull()
  })

  it('PRM-18: answering never mutates the plan it was given', () => {
    const p = plan({ mode: 'surveil', top: ['a', 'b'], away: [] })
    const snapshot = structuredClone(p)
    const next = nextPlanAnswer(p, prompt('top-order', { options: offered(['a', 'b']) }))
    expect(next?.plan.settled).toBe(true)
    expect(next?.plan).not.toBe(p)
    expect(p).toEqual(snapshot)
  })
})
