import { describe, expect, it } from 'vitest'
import { deckTypeFamily, groupGameTypes, visualOf } from './formatFamily'
import type { GameTypeInfo } from '../../net/commands'

describe('deckTypeFamily', () => {
  it('groups formats by the prefix of their name', () => {
    expect(deckTypeFamily('Constructed - Modern')).toBe('constructed')
    expect(deckTypeFamily('Block Constructed - Innistrad')).toBe('block')
    expect(deckTypeFamily('Variant Magic - Commander')).toBe('variant')
    expect(deckTypeFamily('Limited')).toBe('limited')
  })
})

describe('visualOf', () => {
  it('gives every Commander-based variant the crown, and the specific variants their own icon', () => {
    expect(visualOf('Variant Magic - Commander')).toMatchObject({ icon: 'crown', tone: 'gold' })
    expect(visualOf('Freeform Commander Two Player Duel')).toMatchObject({ icon: 'crown' })
    expect(visualOf('Variant Magic - Momir Basic')).toMatchObject({ icon: 'dice', tone: 'violet' })
    expect(visualOf('Variant Magic - Oathbreaker')).toMatchObject({ icon: 'wand' })
    expect(visualOf('Constructed - Pauper')).toMatchObject({ icon: 'circle', tone: 'warn' })
    expect(visualOf('Limited')).toMatchObject({ icon: 'layers' })
  })

  it('falls back to the duel look for anything unknown', () => {
    expect(visualOf('Something Else')).toMatchObject({ icon: 'swords', art: null })
  })
})

const gameTypes: GameTypeInfo[] = [
  { name: 'Two Player Duel', minPlayers: 2, maxPlayers: 2 },
  { name: 'Free For All', minPlayers: 3, maxPlayers: 10 },
  { name: 'Commander Two Player Duel', minPlayers: 2, maxPlayers: 2 },
  { name: 'Commander Free For All', minPlayers: 3, maxPlayers: 10 },
  { name: 'Freeform Unlimited Commander', minPlayers: 2, maxPlayers: 10 },
]

describe('groupGameTypes', () => {
  const bases = groupGameTypes(gameTypes)

  it('puts the duel and the multiplayer of one format base on the same card', () => {
    const commander = bases.find((b) => b.label === 'Commander')!
    expect(commander.modes.map((m) => [m.mode, m.value])).toEqual([
      ['duel', 'Commander Two Player Duel'],
      ['multi', 'Commander Free For All'],
    ])
    expect(commander.family).toBe('variant')
  })

  it('keeps the plain duel and free-for-all together as the classic base', () => {
    const classic = bases.find((b) => b.id === 'classic')!
    expect(classic.label).toBe('')
    expect(classic.family).toBe('classic')
    expect(classic.modes.map((m) => m.value)).toEqual(['Two Player Duel', 'Free For All'])
  })

  it('keeps a type with no duel or multiplayer suffix as a base of its own', () => {
    const own = bases.find((b) => b.label === 'Freeform Unlimited Commander')!
    expect(own.modes).toEqual([{ value: 'Freeform Unlimited Commander', mode: 'any', meta: '2–10' }])
  })

  it('reports the player range of each mode', () => {
    const commander = bases.find((b) => b.label === 'Commander')!
    expect(commander.modes.map((m) => m.meta)).toEqual(['2–2', '3–10'])
  })
})
