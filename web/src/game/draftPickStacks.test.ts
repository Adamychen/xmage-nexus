import { describe, expect, it } from 'vitest'
import { buildDraftPickZones } from './draftPickStacks'
import type { SimpleCardView } from '../net/types'
import type { CardStripMeta } from '../decks/ArenaCardStrip'
import type { StackLabels } from '../decks/stackColumns'

const labels: StackLabels = {
  type: { creatures: 'Creatures', planeswalkers: 'Planeswalkers', instants: 'Instants', sorceries: 'Sorceries', enchantments: 'Enchantments', artifacts: 'Artifacts', lands: 'Lands', other: 'Other' },
  cmc: (n) => (n === 6 ? '6+' : `MV ${n}`),
  lands: 'Lands',
  color: { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', multi: 'Multicolour', colorless: 'Colourless' },
  rarity: { mythic: 'Mythic', rare: 'Rare', uncommon: 'Uncommon', common: 'Common', other: 'Other' },
  edh: (n) => `EDH: ${n}`,
  loading: 'Loading',
  unsorted: 'Unsorted',
  commander: 'Commander',
}

const pick = (id: string, name: string, cardNumber = id): SimpleCardView =>
  ({ id, name, expansionSetCode: 'M21', cardNumber }) as SimpleCardView

const metas: Record<string, CardStripMeta> = {
  Bolt: { name: 'Bolt', typeLine: 'Instant', cmc: 1 },
  Angel: { name: 'Angel', typeLine: 'Creature — Angel', cmc: 3 },
  Island: { name: 'Island', typeLine: 'Basic Land — Island', cmc: 0 },
  Bear: { name: 'Bear', typeLine: 'Creature — Bear', cmc: 2 },
}
const metaOf = (p: SimpleCardView) => metas[p.name ?? '']

describe('buildDraftPickZones', () => {
  it('TRN-21: splits picks into mana-value piles with lands last and hidden picks in the sideboard', () => {
    const picks = [pick('p-1', 'Bolt'), pick('p-2', 'Angel'), pick('p-3', 'Island'), pick('p-4', 'Bear')]
    const zones = buildDraftPickZones(picks, new Set(['p-4']), metaOf, labels, 'Sideboard')
    expect(zones.deck.map((c) => c.id)).toEqual(['cmc-1', 'cmc-3', 'lands'])
    expect(zones.side.map((c) => ({ id: c.id, label: c.label, keys: c.items.map((i) => i.key) }))).toEqual([
      { id: 'sideboard', label: 'Sideboard', keys: ['p-4'] },
    ])
  })

  it('TRN-21: keeps two picks of the same printing as two cards', () => {
    const zones = buildDraftPickZones([pick('a', 'Bear', '7'), pick('b', 'Bear', '7')], new Set(), metaOf, labels, 'Sideboard')
    expect(zones.deck.flatMap((c) => c.items.map((i) => i.key))).toEqual(['a', 'b'])
    expect(zones.side).toEqual([])
  })

  it('TRN-21: puts picks without data in the Loading pile', () => {
    const zones = buildDraftPickZones([pick('x', '')], new Set(), () => undefined, labels, 'Sideboard')
    expect(zones.deck).toHaveLength(1)
    expect(zones.deck[0].kind).toBe('loading')
    expect(zones.deck[0].items.map((i) => i.key)).toEqual(['x'])
  })
})
