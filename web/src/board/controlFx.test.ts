import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearControlChanges, controlChangeTint, controlChanges, primeControlChanges } from './controlFx'
import { makeGameView, makePermanent, makePlayer } from '../__fixtures__/gameViews'

const elf = makePermanent({ id: 'e', name: 'Elvish Mystic' })
const me = makePlayer({ playerId: 'me', name: 'A', controlled: true })
const opp = makePlayer({ playerId: 'o', name: 'B' })

describe('controlChanges', () => {
  it("reads the same id moving to another player's battlefield as a control change, both ways", () => {
    const theirs = makeGameView({ players: [me, { ...opp, battlefield: { e: elf } }] })
    const mine = makeGameView({ players: [{ ...me, battlefield: { e: elf } }, opp] })
    expect(controlChanges(theirs, mine)).toEqual([{ id: 'e', from: 'o', to: 'me' }])
    expect(controlChanges(mine, theirs)).toEqual([{ id: 'e', from: 'me', to: 'o' }])
  })

  it('a permanent that stays, enters or leaves did not change controller', () => {
    const theirs = makeGameView({ players: [me, { ...opp, battlefield: { e: elf } }] })
    expect(controlChanges(theirs, theirs)).toEqual([])
    expect(controlChanges(makeGameView({ players: [me, opp] }), theirs)).toEqual([])
    expect(controlChanges(theirs, makeGameView({ players: [me, opp] }))).toEqual([])
    expect(controlChanges(null, theirs)).toEqual([])
  })
})

describe('primeControlChanges', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clearControlChanges()
  })

  afterEach(() => {
    vi.useRealTimers()
    clearControlChanges()
  })

  it("tells a mounting slot it was taken, in its new controller's seat colour, for a moment", () => {
    const theirs = makeGameView({ players: [me, { ...opp, battlefield: { e: elf } }] })
    const mine = makeGameView({ players: [{ ...me, battlefield: { e: elf } }, opp] })
    primeControlChanges(theirs, mine)
    expect(controlChangeTint('e')).toBe('var(--seat-0)')
    primeControlChanges(mine, theirs)
    expect(controlChangeTint('e')).toBe('var(--seat-1)')
    expect(controlChangeTint('other')).toBeNull()
    vi.advanceTimersByTime(2000)
    expect(controlChangeTint('e')).toBeNull()
  })
})
