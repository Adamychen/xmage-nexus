import { describe, expect, it } from 'vitest'
import {
  hasActiveArenaFilters,
  matchesArenaFilters,
  matchesRawQuery,
  sortSuggestionEntries,
  type ArenaFilterValues,
} from './filterMatch'
import type { ScryfallSearchCard } from './scryfallSearch'

function card(over: Partial<ScryfallSearchCard> & { name: string }): ScryfallSearchCard {
  return {
    id: `id-${over.name}`,
    set: 'tst',
    collector_number: '1',
    cmc: 1,
    type_line: 'Artifact',
    colors: [],
    color_identity: [],
    ...over,
  }
}

function filters(over: Partial<ArenaFilterValues> = {}): ArenaFilterValues {
  return {
    rawQuery: '',
    colorFilter: new Set(),
    cmcFilter: null,
    typeFilter: null,
    rarityFilter: new Set(),
    keywordFilter: new Set(),
    powerFilter: null,
    toughnessFilter: null,
    setFilter: null,
    ...over,
  }
}

describe('hasActiveArenaFilters', () => {
  it('is false with defaults and true with any filter', () => {
    expect(hasActiveArenaFilters(filters())).toBe(false)
    expect(hasActiveArenaFilters(filters({ rawQuery: '  ' }))).toBe(false)
    expect(hasActiveArenaFilters(filters({ cmcFilter: 0 }))).toBe(true)
    expect(hasActiveArenaFilters(filters({ colorFilter: new Set(['R']) }))).toBe(true)
    expect(hasActiveArenaFilters(filters({ setFilter: 'mh3' }))).toBe(true)
  })
})

describe('matchesRawQuery', () => {
  const bolt = card({
    name: 'Lightning Bolt',
    type_line: 'Instant',
    oracle_text: 'Lightning Bolt deals 3 damage to any target.',
    cmc: 1,
    set: 'lea',
    rarity: 'common',
    color_identity: ['R'],
  })
  const elf = card({
    name: 'Llanowar Elves',
    type_line: 'Creature — Elf Druid',
    oracle_text: '{T}: Add {G}.',
    cmc: 1,
    set: 'm21',
    rarity: 'common',
    color_identity: ['G'],
    power: '1',
    toughness: '1',
    keywords: ['Mana dorks'],
  })
  const wrath = card({
    name: 'Wrath of God',
    type_line: 'Sorcery',
    oracle_text: 'Destroy all creatures. They can\'t be regenerated.',
    cmc: 4,
    set: '10e',
    rarity: 'rare',
    color_identity: ['W'],
  })

  it('matches bare text against name, type and oracle', () => {
    expect(matchesRawQuery(bolt, 'bolt')).toBe(true)
    expect(matchesRawQuery(bolt, 'instant')).toBe(true)
    expect(matchesRawQuery(bolt, 'damage')).toBe(true)
    expect(matchesRawQuery(bolt, 'creature')).toBe(false)
    expect(matchesRawQuery(elf, 'creature')).toBe(true)
  })

  it('evaluates the documented Scryfall predicates', () => {
    expect(matchesRawQuery(elf, 't:creature')).toBe(true)
    expect(matchesRawQuery(bolt, 't:creature')).toBe(false)
    expect(matchesRawQuery(elf, 'o:"add {g}"')).toBe(true)
    expect(matchesRawQuery(wrath, 'cmc<=3')).toBe(false)
    expect(matchesRawQuery(bolt, 'cmc<=3')).toBe(true)
    expect(matchesRawQuery(elf, 'pow>0')).toBe(true)
    expect(matchesRawQuery(bolt, 'pow>0')).toBe(false)
    expect(matchesRawQuery(wrath, 'rarity:rare')).toBe(true)
    expect(matchesRawQuery(wrath, 'rarity:mythic')).toBe(false)
    expect(matchesRawQuery(elf, 'set:m21')).toBe(true)
    expect(matchesRawQuery(elf, 'set:m20')).toBe(false)
    expect(matchesRawQuery(bolt, 'f:legacy')).toBe(false)
    expect(matchesRawQuery(card({ name: 'X', legalities: { legacy: 'legal' } }), 'f:legacy')).toBe(true)
  })

  it('supports color identity predicates and quoted values', () => {
    expect(matchesRawQuery(bolt, 'c:r')).toBe(true)
    expect(matchesRawQuery(elf, 'c:r')).toBe(false)
    expect(matchesRawQuery(elf, 'id<=rg')).toBe(true)
    expect(matchesRawQuery(wrath, 'id<=rg')).toBe(false)
    expect(matchesRawQuery(bolt, 't:"creature elf"')).toBe(false)
    expect(matchesRawQuery(elf, 't:"elf druid"')).toBe(true)
  })

  it('supports negation and exact names', () => {
    expect(matchesRawQuery(bolt, '-t:creature')).toBe(true)
    expect(matchesRawQuery(elf, '-t:creature')).toBe(false)
    expect(matchesRawQuery(bolt, '!"Lightning Bolt"')).toBe(true)
    expect(matchesRawQuery(bolt, '!"Lightning Helix"')).toBe(false)
  })

  it('ignores Scryfall directives it cannot evaluate', () => {
    expect(matchesRawQuery(bolt, 'game:paper -t:basic')).toBe(true)
    expect(matchesRawQuery(elf, 'is:commander')).toBe(true)
  })

  it('matches double-faced cards through their faces', () => {
    const dfc = card({
      name: 'Slicer, Hired Muscle // Slicer, High-Speed Antagonist',
      type_line: 'Legendary Artifact Creature — Robot // Legendary Artifact Creature — Robot',
      color_identity: ['R'],
      card_faces: [
        { name: 'Slicer, Hired Muscle', oracle_text: 'Double strike', type_line: 'Legendary Artifact Creature' },
        { name: 'Slicer, High-Speed Antagonist', oracle_text: 'Haste', type_line: 'Legendary Artifact Creature' },
      ],
    })
    expect(matchesRawQuery(dfc, 'o:haste')).toBe(true)
    expect(matchesRawQuery(dfc, '!"Slicer, Hired Muscle"')).toBe(true)
    expect(matchesRawQuery(dfc, 'slicer')).toBe(true)
  })
})

describe('matchesArenaFilters', () => {
  const elf = card({
    name: 'Llanowar Elves',
    type_line: 'Creature — Elf Druid',
    oracle_text: '{T}: Add {G}.',
    cmc: 1,
    rarity: 'common',
    color_identity: ['G'],
    power: '1',
    toughness: '1',
    keywords: ['Flying'],
  })
  const wrath = card({
    name: 'Wrath of God',
    type_line: 'Sorcery',
    cmc: 4,
    rarity: 'rare',
    color_identity: ['W'],
  })
  const relic = card({
    name: 'Relic of Progenitus',
    type_line: 'Artifact',
    cmc: 1,
    rarity: 'uncommon',
    color_identity: [],
    set: 'ala',
  })

  it('applies the color chips as identity subset, C as colorless', () => {
    expect(matchesArenaFilters(elf, filters({ colorFilter: new Set(['G', 'W']) }))).toBe(true)
    expect(matchesArenaFilters(wrath, filters({ colorFilter: new Set(['G']) }))).toBe(false)
    expect(matchesArenaFilters(relic, filters({ colorFilter: new Set(['C']) }))).toBe(true)
    expect(matchesArenaFilters(elf, filters({ colorFilter: new Set(['C']) }))).toBe(false)
  })

  it('applies type, cmc (7+), rarity, keyword, stats and set', () => {
    expect(matchesArenaFilters(elf, filters({ typeFilter: 'Creature' }))).toBe(true)
    expect(matchesArenaFilters(elf, filters({ typeFilter: 'Sorcery' }))).toBe(false)
    expect(matchesArenaFilters(wrath, filters({ cmcFilter: 4 }))).toBe(true)
    expect(matchesArenaFilters(wrath, filters({ cmcFilter: 3 }))).toBe(false)
    expect(matchesArenaFilters(relic, filters({ cmcFilter: 7 }))).toBe(false)
    expect(matchesArenaFilters(wrath, filters({ rarityFilter: new Set(['rare']) }))).toBe(true)
    expect(matchesArenaFilters(wrath, filters({ rarityFilter: new Set(['common']) }))).toBe(false)
    expect(matchesArenaFilters(elf, filters({ keywordFilter: new Set(['Flying']) }))).toBe(true)
    expect(matchesArenaFilters(wrath, filters({ keywordFilter: new Set(['Flying']) }))).toBe(false)
    expect(matchesArenaFilters(elf, filters({ powerFilter: { op: '<=', value: 1 } }))).toBe(true)
    expect(matchesArenaFilters(elf, filters({ powerFilter: { op: '>', value: 2 } }))).toBe(false)
    expect(matchesArenaFilters(elf, filters({ toughnessFilter: { op: '=', value: 1 } }))).toBe(true)
    expect(matchesArenaFilters(relic, filters({ setFilter: 'ALA' }))).toBe(true)
    expect(matchesArenaFilters(relic, filters({ setFilter: 'mh3' }))).toBe(false)
  })

  it('combines raw query with the chips', () => {
    expect(matchesArenaFilters(elf, filters({ rawQuery: 't:creature', colorFilter: new Set(['G']) }))).toBe(true)
    expect(matchesArenaFilters(elf, filters({ rawQuery: 't:creature', colorFilter: new Set(['W']) }))).toBe(false)
  })
})

describe('sortSuggestionEntries', () => {
  const entry = (name: string, over: Partial<ScryfallSearchCard> = {}) => ({ card: card({ name, ...over }) })
  const entries = [
    entry('Beta', { cmc: 3, rarity: 'rare', released_at: '2020-01-01', color_identity: ['U'] }),
    entry('Alpha', { cmc: 1, rarity: 'mythic', released_at: '2022-01-01', color_identity: ['W', 'R'] }),
    entry('Gamma', { cmc: 2, rarity: 'common', released_at: '2021-01-01', color_identity: [] }),
  ]
  const names = (list: { card: ScryfallSearchCard }[]) => list.map((e) => e.card.name)

  it('keeps EDHREC order and reverses it only when asked', () => {
    expect(names(sortSuggestionEntries(entries, 'edhrec', 'asc'))).toEqual(['Beta', 'Alpha', 'Gamma'])
    expect(names(sortSuggestionEntries(entries, 'edhrec', 'desc'))).toEqual(['Gamma', 'Alpha', 'Beta'])
  })

  it('sorts by cmc, name, rarity, color and release date', () => {
    expect(names(sortSuggestionEntries(entries, 'cmc', 'asc'))).toEqual(['Alpha', 'Gamma', 'Beta'])
    expect(names(sortSuggestionEntries(entries, 'cmc', 'desc'))).toEqual(['Beta', 'Gamma', 'Alpha'])
    expect(names(sortSuggestionEntries(entries, 'name', 'asc'))).toEqual(['Alpha', 'Beta', 'Gamma'])
    expect(names(sortSuggestionEntries(entries, 'rarity', 'desc'))).toEqual(['Alpha', 'Beta', 'Gamma'])
    expect(names(sortSuggestionEntries(entries, 'color', 'asc'))).toEqual(['Gamma', 'Beta', 'Alpha'])
    expect(names(sortSuggestionEntries(entries, 'released', 'asc'))).toEqual(['Beta', 'Gamma', 'Alpha'])
  })
})
