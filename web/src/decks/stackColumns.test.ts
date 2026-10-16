import { describe, expect, it } from 'vitest'
import { buildTypeColumns } from './stackColumns'
import type { DeckCard } from '../lobby/decks'
import type { CardStripMeta } from './ArenaCardStrip'

const labels = {
  creatures: 'Creatures', planeswalkers: 'Planeswalkers', instants: 'Instants', sorceries: 'Sorceries',
  enchantments: 'Enchantments', artifacts: 'Artifacts', lands: 'Lands', other: 'Other',
}

const card = (cardName: string, amount = 1): DeckCard => ({ cardName, setCode: 'SET', cardNumber: cardName, amount })

const metas: Record<string, Partial<CardStripMeta>> = {
  Bolt: { cmc: 1, typeLine: 'Instant' },
  Shock: { cmc: 1, typeLine: 'Instant' },
  Angel: { cmc: 5, typeLine: 'Creature — Angel' },
  Bear: { cmc: 2, typeLine: 'Creature — Bear' },
  Sol: { cmc: 2, typeLine: 'Artifact' },
  Aura: { cmc: 3, typeLine: 'Enchantment — Aura' },
  Mountain: { cmc: 0, typeLine: 'Basic Land — Mountain' },
  Wrath: { cmc: 4, typeLine: 'Sorcery' },
  Relic: { cmc: 0, typeLine: 'Legendary Relic' },
}
const metaOf = (c: DeckCard) => metas[c.cardName] as CardStripMeta | undefined

describe('buildTypeColumns', () => {
  it('groups by card type in the fixed order, dropping empty types', () => {
    const columns = buildTypeColumns(
      [card('Mountain'), card('Aura'), card('Angel'), card('Bolt'), card('Sol'), card('Wrath')],
      metaOf,
      labels,
    )
    expect(columns.map((c) => c.id)).toEqual(['creatures', 'instants', 'sorceries', 'artifacts', 'enchantments', 'lands'])
    expect(columns.map((c) => c.label)).toEqual(['Creatures', 'Instants', 'Sorceries', 'Artifacts', 'Enchantments', 'Lands'])
  })

  it('puts cards with unknown types in other', () => {
    const columns = buildTypeColumns([card('Relic')], metaOf, labels)
    expect(columns.map((c) => c.id)).toEqual(['other'])
  })

  it('sorts inside a type by mana value, then name', () => {
    const columns = buildTypeColumns([card('Shock', 2), card('Bolt', 4)], metaOf, labels)
    expect(columns[0].items.map((i) => i.card.cardName)).toEqual(['Bolt', 'Shock'])
    expect(columns[0].items[0].card.amount).toBe(4)
  })

  it('prefixes item keys for the sideboard', () => {
    const columns = buildTypeColumns([card('Bolt')], metaOf, labels, 'sb:')
    expect(columns[0].items[0].key).toBe('sb:SET:Bolt:Bolt')
  })
})
