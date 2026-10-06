import { describe, expect, it } from 'vitest'
import { sortPool } from './poolSort'
import type { DeckCard } from '../lobby/decks'
import type { CardStripMeta } from '../decks/ArenaCardStrip'

const card = (cardName: string): DeckCard => ({ cardName, setCode: 'TST', cardNumber: cardName, amount: 1 }) as DeckCard

const META: Record<string, CardStripMeta> = {
  Bolt: { cmc: 1, colors: ['R'], typeLine: 'Instant' },
  Ogre: { cmc: 3, colors: ['R'], typeLine: 'Creature — Ogre' },
  Angel: { cmc: 5, colors: ['W'], typeLine: 'Creature — Angel' },
  Charm: { cmc: 3, colors: ['U', 'R'], typeLine: 'Instant' },
  Golem: { cmc: 4, colors: [], typeLine: 'Artifact Creature — Golem' },
  Mountain: { cmc: 0, colors: [], typeLine: 'Basic Land — Mountain' },
  Sign: { cmc: 2, colors: [], typeLine: 'Artifact' },
}
const pool = ['Mountain', 'Ogre', 'Mystery', 'Charm', 'Golem', 'Bolt', 'Angel', 'Sign'].map(card)
const names = (sort: Parameters<typeof sortPool>[1]) => sortPool(pool, sort, (c) => META[c.cardName]).map((c) => c.cardName)

describe('sortPool', () => {
  it('by colour: WUBRG, then gold, colourless and lands; unknown last', () => {
    expect(names('color')).toEqual(['Angel', 'Bolt', 'Ogre', 'Charm', 'Sign', 'Golem', 'Mountain', 'Mystery'])
  })

  it('by mana value with lands after every spell', () => {
    expect(names('cmc')).toEqual(['Bolt', 'Sign', 'Charm', 'Ogre', 'Golem', 'Angel', 'Mountain', 'Mystery'])
  })

  it('by type using the main type (an artifact creature is a creature)', () => {
    expect(names('type')).toEqual(['Ogre', 'Golem', 'Angel', 'Bolt', 'Charm', 'Sign', 'Mountain', 'Mystery'])
  })

  it('by name, without touching the input', () => {
    const before = pool.map((c) => c.cardName)
    expect(names('name')).toEqual(['Angel', 'Bolt', 'Charm', 'Golem', 'Mountain', 'Mystery', 'Ogre', 'Sign'])
    expect(pool.map((c) => c.cardName)).toEqual(before)
  })
})
