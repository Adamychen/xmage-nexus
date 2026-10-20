import { describe, expect, it } from 'vitest'
import { copiedSpellId, ultimatePlaneswalkerIds } from './gameTransitionEngine'
import { passedDesignations } from './designationFx'
import { makeCard, makeGameView, makePermanent, makePlayer } from '../__fixtures__/gameViews'

const bolt = (id: string, controllerId: string) => makeCard({ id, name: 'Lightning Bolt', cardTypes: ['Instant'], controllerId })

describe('copiedSpellId', () => {
  const me = makePlayer({ playerId: 'me', name: 'Alice', controlled: true, handCount: 3 })
  const opp = makePlayer({ playerId: 'opp', name: 'Bob', handCount: 4 })

  it('reads a new same-name spell as a copy of the one on the stack', () => {
    const prev = makeGameView({ players: [me, opp], stack: { a: bolt('a', 'me') } })
    const next = makeGameView({ players: [me, opp], stack: { a: bolt('a', 'me'), b: bolt('b', 'me') } })
    expect(copiedSpellId('b', next.stack.b, prev, next)).toBe('a')
  })

  it('a second copy of the same card cast from my hand is a cast', () => {
    const prev = makeGameView({ players: [me, opp], stack: { a: bolt('a', 'me') }, myHand: { b: bolt('b', 'me') } })
    const next = makeGameView({ players: [me, opp], stack: { a: bolt('a', 'me'), b: bolt('b', 'me') }, myHand: {} })
    expect(copiedSpellId('b', next.stack.b, prev, next)).toBeNull()
  })

  it('an opponent casting the same card from their hand is a cast', () => {
    const prev = makeGameView({ players: [me, opp], stack: { a: bolt('a', 'me') } })
    const next = makeGameView({ players: [me, { ...opp, handCount: 3 }], stack: { a: bolt('a', 'me'), b: bolt('b', 'opp') } })
    expect(copiedSpellId('b', next.stack.b, prev, next)).toBeNull()
  })

  it('needs an original of the same name', () => {
    const prev = makeGameView({ players: [me, opp], stack: {} })
    const next = makeGameView({ players: [me, opp], stack: { b: bolt('b', 'me') } })
    expect(copiedSpellId('b', next.stack.b, prev, next)).toBeNull()
  })
})

describe('ultimatePlaneswalkerIds', () => {
  const pw = (loyalty: string) => makePermanent({ name: 'Jace', cardTypes: ['Planeswalker'], loyalty })

  it('reads a loyalty drop of 6 or more as an ultimate', () => {
    const prevP = makePlayer({ playerId: 'p', name: 'A', battlefield: { j: pw('8') } })
    expect(ultimatePlaneswalkerIds(prevP, { ...prevP, battlefield: { j: pw('1') } }, {}, {})).toEqual(['j'])
    expect(ultimatePlaneswalkerIds(prevP, { ...prevP, battlefield: { j: pw('5') } }, {}, {})).toEqual([])
  })

  it('reads a planeswalker that died paying for its own new ability as an ultimate', () => {
    const prevP = makePlayer({ playerId: 'p', name: 'A', battlefield: { j: pw('7') } })
    const nextP = { ...prevP, battlefield: {} }
    const ability = makeCard({ id: 'ab', name: 'Ultimate', isAbility: true, sourceCard: makeCard({ id: 'j', name: 'Jace' }) })
    expect(ultimatePlaneswalkerIds(prevP, nextP, {}, { ab: ability })).toEqual(['j'])
    expect(ultimatePlaneswalkerIds(prevP, nextP, {}, {})).toEqual([])
  })
})

describe('passedDesignations', () => {
  const a = makePlayer({ playerId: 'a', name: 'A' })
  const b = makePlayer({ playerId: 'b', name: 'B' })

  it('names the old and the new holder', () => {
    const prev = makeGameView({ players: [{ ...a, monarch: true }, b] })
    const next = makeGameView({ players: [a, { ...b, monarch: true }] })
    expect(passedDesignations(prev, next)).toEqual([{ kind: 'monarch', from: 'a', to: 'b' }])
  })

  it('a designation nobody held comes from nowhere; one kept or lost does not move', () => {
    const none = makeGameView({ players: [a, b] })
    const held = makeGameView({ players: [{ ...a, initiative: true }, b] })
    expect(passedDesignations(none, held)).toEqual([{ kind: 'initiative', from: null, to: 'a' }])
    expect(passedDesignations(held, held)).toEqual([])
    expect(passedDesignations(held, none)).toEqual([])
  })
})
