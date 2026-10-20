import { afterEach, describe, expect, it } from 'vitest'
import { animateColor, clearCreatureShifts, creatureShiftOf, creatureShifts, primeCreatureShifts } from './creatureShiftFx'
import { makeGameView, makePermanent, makePlayer } from '../__fixtures__/gameViews'

const village = (types: string[]) => makePermanent({ id: 'v', name: 'Treetop Village', cardTypes: types, rules: ['{T}: Add {G}.'] })

describe('creatureShifts', () => {
  afterEach(() => clearCreatureShifts())

  it('reads a land that gains CREATURE as rising and one that loses it as settling', () => {
    const land = makePlayer({ playerId: 'me', name: 'A', battlefield: { v: village(['LAND']) } })
    const animated = makePlayer({ playerId: 'me', name: 'A', battlefield: { v: village(['LAND', 'CREATURE']) } })
    expect(creatureShifts(land, animated)).toEqual([{ id: 'v', playerId: 'me', rises: true }])
    expect(creatureShifts(animated, land)).toEqual([{ id: 'v', playerId: 'me', rises: false }])
  })

  it('a crewed vehicle rises; a permanent that transformed or entered does not', () => {
    const copter = (types: string[], over = {}) => makePermanent({ id: 'c', name: "Smuggler's Copter", cardTypes: types, ...over })
    const before = makePlayer({ playerId: 'me', name: 'A', battlefield: { c: copter(['ARTIFACT']) } })
    expect(creatureShifts(before, { ...before, battlefield: { c: copter(['ARTIFACT', 'CREATURE']) } })).toHaveLength(1)
    expect(creatureShifts(before, { ...before, battlefield: { c: copter(['ARTIFACT', 'CREATURE'], { transformed: true }) } })).toHaveLength(0)
    expect(creatureShifts(makePlayer({ playerId: 'me', name: 'A' }), { ...before, battlefield: { c: copter(['ARTIFACT', 'CREATURE']) } })).toHaveLength(0)
  })

  it('primes the shift for the slot that remounts in the other band', () => {
    const prev = makeGameView({ players: [makePlayer({ playerId: 'me', name: 'A', battlefield: { v: village(['LAND']) } })] })
    const next = makeGameView({ players: [makePlayer({ playerId: 'me', name: 'A', battlefield: { v: village(['LAND', 'CREATURE']) } })] })
    primeCreatureShifts(prev, next)
    expect(creatureShiftOf('v')).toBe('rise')
    expect(creatureShiftOf('other')).toBeNull()
  })

  it('glows in the mana a land makes', () => {
    expect(animateColor(village(['LAND']))).toBe('g')
  })
})
