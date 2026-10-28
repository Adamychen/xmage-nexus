import { describe, expect, it } from 'vitest'
import { buildStackColumns, buildTypeColumns, canSeparateCreatures, splitCreatureRows, type StackGroup, type StackLabels } from './stackColumns'
import { deckCardKey } from './deckCardOps'
import type { DeckCard } from '../lobby/decks'
import type { CardStripMeta } from './ArenaCardStrip'
import type { DeckStackPiles } from './stackPiles'

const labels = {
  creatures: 'Creatures', planeswalkers: 'Planeswalkers', instants: 'Instants', sorceries: 'Sorceries',
  enchantments: 'Enchantments', artifacts: 'Artifacts', lands: 'Lands', other: 'Other',
}

const stackLabels: StackLabels = {
  type: labels,
  cmc: (n) => (n === 6 ? '6+' : `MV ${n}`),
  lands: 'Lands',
  color: { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', multi: 'Multicolour', colorless: 'Colourless' },
  rarity: { mythic: 'Mythic', rare: 'Rare', uncommon: 'Uncommon', common: 'Common', other: 'Other' },
  edh: (n) => `EDH: ${n}`,
  loading: 'Loading',
  unsorted: 'Unsorted',
  commander: 'Commander',
}

const card = (cardName: string, amount = 1): DeckCard => ({ cardName, setCode: 'SET', cardNumber: cardName, amount })

const metas: Record<string, Partial<CardStripMeta>> = {
  Bolt: { cmc: 1, typeLine: 'Instant', colors: ['R'], rarity: 'common' },
  Shock: { cmc: 1, typeLine: 'Instant', colors: ['R'], rarity: 'common' },
  Angel: { cmc: 5, typeLine: 'Creature — Angel', colors: ['W'], rarity: 'rare' },
  Bear: { cmc: 2, typeLine: 'Creature — Bear', colors: ['G'], rarity: 'common' },
  Sol: { cmc: 2, typeLine: 'Artifact', colors: [], rarity: 'uncommon' },
  Aura: { cmc: 3, typeLine: 'Enchantment — Aura', colors: ['U'], rarity: 'uncommon' },
  Mountain: { cmc: 0, typeLine: 'Basic Land — Mountain', colors: [], rarity: 'common' },
  Wrath: { cmc: 4, typeLine: 'Sorcery', colors: ['B'], rarity: 'rare' },
  Relic: { cmc: 0, typeLine: 'Legendary Relic', colors: [], rarity: 'special' },
  Helix: { cmc: 2, typeLine: 'Instant', colors: ['R', 'W'], rarity: 'uncommon' },
  Foundry: { cmc: 0, typeLine: 'Land — Mountain Plains', colors: [], rarity: 'rare' },
  Titan: { cmc: 6, typeLine: 'Creature — Giant', colors: ['G'], rarity: 'mythic' },
  Dragon: { cmc: 9, typeLine: 'Creature — Dragon', colors: ['R'], rarity: 'mythic' },
  Walker: { cmc: 4, typeLine: 'Legendary Planeswalker — Jace', colors: ['U'], rarity: 'mythic' },
  Golem: { cmc: 3, typeLine: 'Artifact Creature — Golem', colors: [], rarity: 'bonus' },
}
const metaOf = (c: DeckCard) => metas[c.cardName] as CardStripMeta | undefined
const names = (items: { card: DeckCard }[]) => items.map((i) => i.card.cardName)
const ids = (columns: { id: string }[]) => columns.map((c) => c.id)

const freePiles: DeckStackPiles = {
  piles: [{ id: 'p1', label: 'Spells' }],
  assign: { [deckCardKey(card('Bolt'))]: { p1: 1 } },
}

describe('buildTypeColumns', () => {
  it('DCK-6: groups by card type in the fixed order, dropping empty types', () => {
    const columns = buildTypeColumns(
      [card('Mountain'), card('Aura'), card('Angel'), card('Bolt'), card('Sol'), card('Wrath')],
      metaOf,
      labels,
    )
    expect(columns.map((c) => c.id)).toEqual(['creatures', 'instants', 'sorceries', 'artifacts', 'enchantments', 'lands'])
    expect(columns.map((c) => c.label)).toEqual(['Creatures', 'Instants', 'Sorceries', 'Artifacts', 'Enchantments', 'Lands'])
  })

  it('DCK-11: other holds only cards whose type line is known and fits no other pile', () => {
    const columns = buildTypeColumns([card('Relic')], metaOf, labels)
    expect(columns.map((c) => c.id)).toEqual(['other'])
  })

  it('DCK-6: sorts inside a type by mana value, then name', () => {
    const columns = buildTypeColumns([card('Shock', 2), card('Bolt', 4)], metaOf, labels)
    expect(columns[0].items.map((i) => i.card.cardName)).toEqual(['Bolt', 'Shock'])
    expect(columns[0].items[0].card.amount).toBe(4)
  })

  it('prefixes item keys for the sideboard', () => {
    const columns = buildTypeColumns([card('Bolt')], metaOf, labels, 'sb:')
    expect(columns[0].items[0].key).toBe('sb:SET:Bolt:Bolt')
  })

  it('DCK-11: a card without meta waits in a loading column, never in other', () => {
    const columns = buildTypeColumns([card('Pending')], metaOf, { ...labels, loading: 'Loading' })
    expect(ids(columns)).toEqual(['loading'])
    expect(columns[0]).toMatchObject({ label: 'Loading', kind: 'loading' })
    expect(columns[0].items[0].loading).toBe(true)
  })

  it('DCK-11: a card whose meta has only its name is still loading in every grouping, never in other', () => {
    const nameOnly = (c: DeckCard) => (c.cardName === 'Stub' ? { name: 'Stub' } : metaOf(c))
    for (const group of ['type', 'cmc', 'color', 'rarity'] as const) {
      const columns = buildStackColumns([card('Stub'), card('Bolt')], nameOnly, { group, sort: 'cmc', labels: stackLabels })
      expect(columns.find((c) => c.kind === 'loading')?.items.map((i) => i.card.cardName)).toEqual(['Stub'])
      expect(columns.find((c) => c.id === 'other')).toBeUndefined()
      expect(columns.flatMap((c) => c.items).find((i) => i.card.cardName === 'Stub')?.loading).toBe(true)
    }
  })

  it('DCK-11: a meta with an empty type line is not loaded', () => {
    const columns = buildTypeColumns([card('Blank')], () => ({ typeLine: '', cmc: 1 }), labels)
    expect(ids(columns)).toEqual(['loading'])
  })
})

describe('buildStackColumns grouping', () => {
  it('DCK-6: mana value groups run 0 to 5 then 6+, with lands in their own last pile', () => {
    const columns = buildStackColumns(
      [card('Bolt'), card('Bear'), card('Sol'), card('Titan'), card('Dragon'), card('Foundry'), card('Mountain'), card('Relic')],
      metaOf,
      { group: 'cmc', sort: 'cmc', labels: stackLabels },
    )
    expect(ids(columns)).toEqual(['cmc-0', 'cmc-1', 'cmc-2', 'cmc-6', 'lands'])
    expect(columns.map((c) => c.label)).toEqual(['MV 0', 'MV 1', 'MV 2', '6+', 'Lands'])
    expect(names(columns[2].items)).toEqual(['Bear', 'Sol'])
    expect(names(columns[3].items)).toEqual(['Dragon', 'Titan'])
    expect(names(columns[4].items)).toEqual(['Foundry', 'Mountain'])
  })

  it('DCK-6: colour groups white to green, then multicolour, colourless and lands', () => {
    const columns = buildStackColumns(
      [card('Angel'), card('Walker'), card('Wrath'), card('Bolt'), card('Bear'), card('Helix'), card('Relic'), card('Foundry'), card('Mountain')],
      metaOf,
      { group: 'color', sort: 'cmc', labels: stackLabels },
    )
    expect(ids(columns)).toEqual(['W', 'U', 'B', 'R', 'G', 'multi', 'colorless', 'lands'])
    expect(names(columns.find((c) => c.id === 'multi')!.items)).toEqual(['Helix'])
    expect(names(columns.find((c) => c.id === 'colorless')!.items)).toEqual(['Relic'])
    expect(names(columns.find((c) => c.id === 'lands')!.items)).toEqual(['Foundry', 'Mountain'])
  })

  it('DCK-6: rarity groups mythic to common, with special and bonus cards in other', () => {
    const columns = buildStackColumns(
      [card('Titan'), card('Angel'), card('Helix'), card('Bear'), card('Relic'), card('Golem'), card('Walker')],
      metaOf,
      { group: 'rarity', sort: 'cmc', labels: stackLabels },
    )
    expect(ids(columns)).toEqual(['mythic', 'rare', 'uncommon', 'common', 'other'])
    expect(names(columns[0].items)).toEqual(['Walker', 'Titan'])
    expect(names(columns[4].items)).toEqual(['Relic', 'Golem'])
  })

  it('DCK-6: sort by name orders every pile alphabetically, sort by mana value otherwise', () => {
    const byValue = buildStackColumns([card('Titan'), card('Angel'), card('Bear')], metaOf, { group: 'type', sort: 'cmc', labels: stackLabels })
    const byName = buildStackColumns([card('Titan'), card('Angel'), card('Bear')], metaOf, { group: 'type', sort: 'name', labels: stackLabels })
    expect(names(byValue[0].items)).toEqual(['Bear', 'Angel', 'Titan'])
    expect(names(byName[0].items)).toEqual(['Angel', 'Bear', 'Titan'])
    const cmcValue = buildStackColumns([card('Aura'), card('Golem')], metaOf, { group: 'cmc', sort: 'cmc', labels: stackLabels })
    const cmcName = buildStackColumns([card('Aura'), card('Golem')], metaOf, { group: 'cmc', sort: 'name', labels: stackLabels })
    expect(names(cmcValue[0].items)).toEqual(['Golem', 'Aura'])
    expect(names(cmcName[0].items)).toEqual(['Aura', 'Golem'])
  })

  it('DCK-6: groupings drop their empty columns', () => {
    const columns = buildStackColumns([card('Bolt')], metaOf, { group: 'rarity', sort: 'cmc', labels: stackLabels })
    expect(ids(columns)).toEqual(['common'])
  })

  it('DCK-6: a commander is a fixed first pile in every grouping, and drops out when empty', () => {
    const commanderKeys = new Set([deckCardKey(card('Angel'))])
    const groups: StackGroup[] = ['type', 'cmc', 'color', 'rarity', 'free']
    for (const group of groups) {
      const columns = buildStackColumns([card('Angel'), card('Bolt')], metaOf, {
        group, sort: 'cmc', labels: stackLabels, commanderKeys, piles: freePiles,
      })
      expect(columns[0]).toMatchObject({ id: 'commander', kind: 'commander', label: 'Commander' })
      expect(names(columns[0].items)).toEqual(['Angel'])
      expect(columns.slice(1).flatMap((c) => names(c.items))).not.toContain('Angel')

      const none = buildStackColumns([card('Angel')], metaOf, { group, sort: 'cmc', labels: stackLabels, commanderKeys: new Set() })
      expect(ids(none)).not.toContain('commander')
    }
  })
})

describe('buildStackColumns free piles', () => {
  it('DCK-7: free draws the piles in the player order, empty piles included', () => {
    const piles: DeckStackPiles = {
      piles: [{ id: 'p2', label: 'Late' }, { id: 'p1', label: 'Early' }, { id: 'p3', label: 'Empty' }],
      assign: { [deckCardKey(card('Bolt'))]: { p1: 1 }, [deckCardKey(card('Titan'))]: { p2: 1 } },
    }
    const columns = buildStackColumns([card('Bolt'), card('Titan')], metaOf, { group: 'free', sort: 'cmc', labels: stackLabels, piles })
    expect(ids(columns)).toEqual(['p2', 'p1', 'p3'])
    expect(columns.map((c) => c.label)).toEqual(['Late', 'Early', 'Empty'])
    expect(columns.map((c) => c.kind)).toEqual(['pile', 'pile', 'pile'])
    expect(names(columns[0].items)).toEqual(['Titan'])
    expect(columns[2].items).toEqual([])
  })

  it('DCK-7: a card with no pile waits in a leading Unsorted pile, drawn only while it holds cards', () => {
    const columns = buildStackColumns([card('Bolt'), card('Bear')], metaOf, { group: 'free', sort: 'cmc', labels: stackLabels, piles: freePiles })
    expect(ids(columns)).toEqual(['unsorted', 'p1'])
    expect(columns[0]).toMatchObject({ label: 'Unsorted', kind: 'unsorted' })
    expect(names(columns[0].items)).toEqual(['Bear'])

    const assigned = buildStackColumns([card('Bolt')], metaOf, { group: 'free', sort: 'cmc', labels: stackLabels, piles: freePiles })
    expect(ids(assigned)).toEqual(['p1'])
  })

  it('DCK-7: a card assigned to a deleted pile is treated as unsorted', () => {
    const piles: DeckStackPiles = { piles: [{ id: 'p1', label: 'Spells' }], assign: { [deckCardKey(card('Bear'))]: { p9: 1 } } }
    const columns = buildStackColumns([card('Bear')], metaOf, { group: 'free', sort: 'cmc', labels: stackLabels, piles })
    expect(ids(columns)).toEqual(['unsorted', 'p1'])
    expect(names(columns[0].items)).toEqual(['Bear'])
  })

  it('DCK-7: free piles sort their cards by mana value then name, or by name', () => {
    const piles: DeckStackPiles = {
      piles: [{ id: 'p1', label: 'Mixed' }],
      assign: { [deckCardKey(card('Bear'))]: { p1: 1 }, [deckCardKey(card('Angel'))]: { p1: 1 } },
    }
    const byValue = buildStackColumns([card('Angel'), card('Bear')], metaOf, { group: 'free', sort: 'cmc', labels: stackLabels, piles })
    const byName = buildStackColumns([card('Angel'), card('Bear')], metaOf, { group: 'free', sort: 'name', labels: stackLabels, piles })
    expect(names(byValue[0].items)).toEqual(['Bear', 'Angel'])
    expect(names(byName[0].items)).toEqual(['Angel', 'Bear'])
  })

  it('DCK-7: a sideboard in free is one pile holding every card, kept even when empty', () => {
    const single = { id: 'sb', label: 'Sideboard' }
    const columns = buildStackColumns([card('Titan'), card('Bolt')], metaOf, {
      group: 'free', sort: 'cmc', labels: stackLabels, piles: freePiles, singlePile: single,
    })
    expect(columns).toHaveLength(1)
    expect(columns[0]).toMatchObject({ id: 'sb', label: 'Sideboard', kind: 'single' })
    expect(names(columns[0].items)).toEqual(['Bolt', 'Titan'])

    const empty = buildStackColumns([], metaOf, { group: 'free', sort: 'cmc', labels: stackLabels, singlePile: single })
    expect(ids(empty)).toEqual(['sb'])
    expect(empty[0].items).toEqual([])
  })
})

describe('buildStackColumns copies split across piles (DCK-7)', () => {
  it('DCK-7: a card with copies in two piles shows in both, each with the copies it holds', () => {
    const piles: DeckStackPiles = {
      piles: [{ id: 'p1', label: 'Burn' }, { id: 'p2', label: 'Other' }],
      assign: { [deckCardKey(card('Bolt', 4))]: { p1: 3, p2: 1 } },
    }
    const columns = buildStackColumns([card('Bolt', 4)], metaOf, { group: 'free', sort: 'cmc', labels: stackLabels, piles })
    expect(ids(columns)).toEqual(['p1', 'p2'])
    expect(columns[0].items).toEqual([expect.objectContaining({ key: deckCardKey(card('Bolt')), card: expect.objectContaining({ amount: 3 }) })])
    expect(columns[1].items).toEqual([expect.objectContaining({ key: deckCardKey(card('Bolt')), card: expect.objectContaining({ amount: 1 }) })])
  })

  it('DCK-7: copies no pile holds go to the pile holding most of the card, and the item keys stay the deck key', () => {
    const piles: DeckStackPiles = { piles: [{ id: 'p1', label: 'Burn' }], assign: { [deckCardKey(card('Bolt', 4))]: { p1: 2 } } }
    const columns = buildStackColumns([card('Bolt', 4)], metaOf, { group: 'free', sort: 'cmc', labels: stackLabels, piles, keyPrefix: 'sb:' })
    expect(ids(columns)).toEqual(['p1'])
    expect(columns[0].items[0]).toMatchObject({ key: `sb:${deckCardKey(card('Bolt'))}`, card: { amount: 4 } })
  })
})

describe('buildStackColumns loading cards', () => {
  it('DCK-11: a card whose data is still loading waits in a Loading column after the commander', () => {
    const commanderKeys = new Set([deckCardKey(card('Angel'))])
    const groups: StackGroup[] = ['type', 'cmc', 'color', 'rarity']
    for (const group of groups) {
      const columns = buildStackColumns([card('Angel'), card('Pending'), card('Bolt')], metaOf, {
        group, sort: 'cmc', labels: stackLabels, commanderKeys,
      })
      expect(ids(columns).slice(0, 2)).toEqual(['commander', 'loading'])
      expect(columns[1]).toMatchObject({ label: 'Loading', kind: 'loading' })
      expect(columns[1].items[0].loading).toBe(true)
      expect(columns.flatMap((c) => c.items).find((i) => i.card.cardName === 'Bolt')?.loading).toBeFalsy()
    }
  })

  it('DCK-11: a loading card is never drawn in other in any grouping', () => {
    const groups: StackGroup[] = ['type', 'cmc', 'color', 'rarity']
    for (const group of groups) {
      const columns = buildStackColumns([card('Pending')], metaOf, { group, sort: 'cmc', labels: stackLabels })
      expect(ids(columns)).toEqual(['loading'])
    }
  })

  it('DCK-11: in free a loading card stays in its pile, and an unassigned one goes to Unsorted', () => {
    const piles: DeckStackPiles = { piles: [{ id: 'p1', label: 'Spells' }], assign: { [deckCardKey(card('Pending'))]: { p1: 1 } } }
    const columns = buildStackColumns([card('Pending'), card('Pending2')], metaOf, { group: 'free', sort: 'cmc', labels: stackLabels, piles })
    expect(ids(columns)).toEqual(['unsorted', 'p1'])
    expect(names(columns[1].items)).toEqual(['Pending'])
    expect(columns[1].items[0].loading).toBe(true)
    expect(names(columns[0].items)).toEqual(['Pending2'])
    expect(columns[0].items[0].loading).toBe(true)
  })
})

const identityMetas: Record<string, CardStripMeta> = {
  Bolt: { typeLine: 'Instant', colors: ['R'], colorIdentity: ['R'], cmc: 1 },
  Commander: { typeLine: 'Legendary Creature — Elf', colors: ['G'], colorIdentity: ['G', 'W'], cmc: 4 },
  Mountain: { typeLine: 'Basic Land — Mountain', colors: [], colorIdentity: [], cmc: 0 },
  Gate: { typeLine: 'Land', colors: [], colorIdentity: ['U'], cmc: 0 },
  Angel: { typeLine: 'Creature — Angel', colors: ['W'], colorIdentity: ['W'], cmc: 5 },
  Legacy: { typeLine: 'Sorcery', colors: ['B'], cmc: 2 },
}
const identityOf = (c: DeckCard) => identityMetas[c.cardName] as CardStripMeta | undefined

const edhMetas: Record<string, Partial<CardStripMeta>> = {
  'Sol Ring': { typeLine: 'Artifact', oracleText: '{T}: Add {C}{C}.', cmc: 1 },
  'Time Walk': { typeLine: 'Sorcery', oracleText: 'Take an extra turn after this one.', cmc: 2 },
  'Grizzly Bears': { typeLine: 'Creature — Bear', oracleText: '', cmc: 2 },
  'Tiny Bear': { typeLine: 'Creature — Bear', oracleText: '', cmc: 1 },
  'Test Annihilator': { typeLine: 'Creature — Eldrazi', oracleText: 'Annihilator 2', cmc: 6 },
}
const edhOf = (c: DeckCard) => edhMetas[c.cardName] as CardStripMeta | undefined

describe('buildStackColumns colour identity', () => {
  it('DCK-15: identity groups by colour identity in WUBRG order, multicolour and colourless last, lands included', () => {
    const columns = buildStackColumns(
      [card('Commander'), card('Mountain'), card('Bolt'), card('Gate'), card('Angel')],
      identityOf,
      { group: 'identity', sort: 'cmc', labels: stackLabels },
    )
    expect(ids(columns)).toEqual(['id-W', 'id-U', 'id-R', 'id-multi', 'id-colorless'])
    expect(columns.map((c) => c.label)).toEqual(['White', 'Blue', 'Red', 'Multicolour', 'Colourless'])
    expect(columns.map((c) => c.kind)).toEqual(['group', 'group', 'group', 'group', 'group'])
    expect(names(columns[1].items)).toEqual(['Gate'])
    expect(names(columns[3].items)).toEqual(['Commander'])
    expect(ids(columns)).not.toContain('lands')
  })

  it('DCK-15: identity reads the colour identity, so a commander with off-colour identity is multicolour', () => {
    const columns = buildStackColumns([card('Commander')], identityOf, { group: 'identity', sort: 'cmc', labels: stackLabels })
    expect(ids(columns)).toEqual(['id-multi'])
  })

  it('DCK-15: identity falls back to the colours when the colour identity is not known', () => {
    const columns = buildStackColumns([card('Legacy')], identityOf, { group: 'identity', sort: 'cmc', labels: stackLabels })
    expect(ids(columns)).toEqual(['id-B'])
  })

  it('DCK-15: identity keeps the commander first and draws a card whose data is loading in the Loading column', () => {
    const commanderKeys = new Set([deckCardKey(card('Angel'))])
    const columns = buildStackColumns([card('Angel'), card('Pending'), card('Bolt')], identityOf, {
      group: 'identity', sort: 'cmc', labels: stackLabels, commanderKeys,
    })
    expect(ids(columns)).toEqual(['commander', 'loading', 'id-R'])
    expect(names(columns[1].items)).toEqual(['Pending'])
    expect(columns[1].items[0].loading).toBe(true)
  })
})

describe('buildStackColumns EDH power level', () => {
  it('DCK-15: edh draws one column per power level present, lowest first, labelled EDH: n', () => {
    const columns = buildStackColumns(
      [card('Sol Ring'), card('Grizzly Bears'), card('Time Walk')],
      edhOf,
      { group: 'edh', sort: 'cmc', labels: stackLabels },
    )
    expect(ids(columns)).toEqual(['edh-0', 'edh-7', 'edh-12'])
    expect(columns.map((c) => c.label)).toEqual(['EDH: 0', 'EDH: 7', 'EDH: 12'])
    expect(names(columns[2].items)).toEqual(['Sol Ring'])
  })

  it('DCK-15: edh scores the deck card name for the name lists, even when the meta has none', () => {
    const columns = buildStackColumns([card('Sol Ring')], edhOf, { group: 'edh', sort: 'cmc', labels: stackLabels })
    expect(ids(columns)).toEqual(['edh-12'])
  })

  it('DCK-15: edh drops empty levels and sorts each pile by mana value then name', () => {
    const columns = buildStackColumns(
      [card('Test Annihilator'), card('Time Walk'), card('Grizzly Bears'), card('Tiny Bear')],
      edhOf,
      { group: 'edh', sort: 'cmc', labels: stackLabels },
    )
    expect(ids(columns)).toEqual(['edh-0', 'edh-5', 'edh-7'])
    expect(names(columns[0].items)).toEqual(['Tiny Bear', 'Grizzly Bears'])
    expect(names(columns[1].items)).toEqual(['Test Annihilator'])
  })

  it('DCK-15: edh keeps the commander first and a loading card in the Loading column', () => {
    const commanderKeys = new Set([deckCardKey(card('Sol Ring'))])
    const columns = buildStackColumns([card('Sol Ring'), card('Pending'), card('Time Walk')], edhOf, {
      group: 'edh', sort: 'cmc', labels: stackLabels, commanderKeys,
    })
    expect(ids(columns)).toEqual(['commander', 'loading', 'edh-7'])
    expect(columns[1].items[0].loading).toBe(true)
  })
})

describe('splitCreatureRows', () => {
  const creatureNames = ['Angel', 'Bear', 'Titan', 'Dragon', 'Golem']
  const otherNames = ['Bolt', 'Sol', 'Mountain', 'Walker', 'Wrath']
  const mixed = [card('Angel'), card('Bear'), card('Titan'), card('Dragon'), card('Golem'), card('Bolt'), card('Sol'), card('Mountain'), card('Walker'), card('Wrath')]
  const opts = (group: StackGroup, extra: Partial<Parameters<typeof splitCreatureRows>[2]> = {}) => ({ group, sort: 'cmc' as const, labels: stackLabels, ...extra })
  const rowNames = (columns: { items: { card: DeckCard }[] }[]) => columns.flatMap((c) => names(c.items))

  it('DCK-16: mana value puts the creatures in the first row and every other card in the second, both grouped by mana value', () => {
    const rows = splitCreatureRows(
      [card('Angel'), card('Bear'), card('Titan'), card('Dragon'), card('Bolt'), card('Sol'), card('Mountain')],
      metaOf,
      opts('cmc'),
    )
    expect(ids(rows.creatures)).toEqual(['cmc-2', 'cmc-5', 'cmc-6'])
    expect(ids(rows.others)).toEqual(['cmc-1', 'cmc-2', 'lands'])
    expect(names(rows.creatures[2].items)).toEqual(['Dragon', 'Titan'])
  })

  it('DCK-16: each row is the same columns the grouping draws for its own cards', () => {
    const creatureCards = mixed.filter((c) => metaOf(c)?.typeLine?.includes('Creature'))
    const rows = splitCreatureRows(mixed, metaOf, opts('color'))
    expect(rows.creatures).toEqual(buildStackColumns(creatureCards, metaOf, opts('color')))
  })

  it('DCK-16: colour groups the creatures first, then the other cards, with lands in the second row', () => {
    const rows = splitCreatureRows(
      [card('Angel'), card('Dragon'), card('Golem'), card('Bolt'), card('Mountain'), card('Walker')],
      metaOf,
      opts('color'),
    )
    expect(ids(rows.creatures)).toEqual(['W', 'R', 'colorless'])
    expect(ids(rows.others)).toEqual(['U', 'R', 'lands'])
  })

  it.each<StackGroup>(['rarity', 'identity', 'edh'])('DCK-16: %s keeps every creature in the first row and no other card', (group) => {
    const rows = splitCreatureRows(mixed, metaOf, opts(group))
    expect(rowNames(rows.creatures).sort()).toEqual([...creatureNames].sort())
    expect(rowNames(rows.others).sort()).toEqual([...otherNames].sort())
  })

  it('DCK-16: a commander stays in the first row whatever its type', () => {
    const rows = splitCreatureRows(mixed, metaOf, opts('cmc', { commanderKeys: new Set([deckCardKey(card('Walker'))]) }))
    expect(rows.creatures[0].id).toBe('commander')
    expect(names(rows.creatures[0].items)).toEqual(['Walker'])
    expect(rowNames(rows.others)).not.toContain('Walker')
  })

  it('DCK-16: a card whose data is still loading waits in the Loading column of the first row', () => {
    const rows = splitCreatureRows([card('Unknown'), card('Bolt')], metaOf, opts('color'))
    expect(ids(rows.creatures)).toEqual(['loading'])
    expect(names(rows.creatures[0].items)).toEqual(['Unknown'])
    expect(rowNames(rows.others)).toEqual(['Bolt'])
  })

  it('DCK-16: sort by name orders the cards inside each row', () => {
    const rows = splitCreatureRows([card('Titan'), card('Dragon'), card('Shock'), card('Bolt')], metaOf, opts('cmc', { sort: 'name' }))
    expect(names(rows.creatures[0].items)).toEqual(['Dragon', 'Titan'])
    expect(names(rows.others[0].items)).toEqual(['Bolt', 'Shock'])
  })

  it.each<StackGroup>(['type', 'free'])('DCK-16: %s is not split, so every column stays in the first row', (group) => {
    const rows = splitCreatureRows(mixed, metaOf, opts(group, { piles: freePiles }))
    expect(rows.others).toEqual([])
    expect(rows.creatures).toEqual(buildStackColumns(mixed, metaOf, opts(group, { piles: freePiles })))
  })

  it('DCK-16: creatures are separated in every grouping except type and free', () => {
    const separate: StackGroup[] = ['cmc', 'color', 'identity', 'edh', 'rarity']
    expect(separate.every((group) => canSeparateCreatures(group))).toBe(true)
    expect(canSeparateCreatures('type')).toBe(false)
    expect(canSeparateCreatures('free')).toBe(false)
  })
})
