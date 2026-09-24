import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DeckCard } from './decks'
import {
  tableFormatProfile,
  deckFitForTable,
  rankDecksForTable,
  pickInitialDeck,
  rememberDeckForFormat,
  deckHighlights,
  deckCoverCard,
  type JoinDeck,
} from './joinDeckFit'

function memoryStorage(): Storage {
  const m = new Map<string, string>()
  return {
    get length() { return m.size },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => { m.set(k, String(v)) },
    removeItem: (k) => { m.delete(k) },
    key: (i) => [...m.keys()][i] ?? null,
  }
}

beforeEach(() => { vi.stubGlobal('localStorage', memoryStorage()) })
afterEach(() => { vi.unstubAllGlobals() })

const card = (cardName: string, amount = 1): DeckCard => ({ cardName, setCode: 'X', cardNumber: '1', amount })

function deck(name: string, size: number, extra: Partial<JoinDeck> = {}): JoinDeck {
  return { id: name, name, cards: [card('Lightning Bolt', 4), card('Mountain', size - 4)], sideboard: [], ...extra }
}

describe('tableFormatProfile', () => {
  it('maps XMage deck types to a format family and minimum', () => {
    expect(tableFormatProfile('Variant Magic - Commander', 'Commander Free For All')).toMatchObject({ family: 'commander', format: 'Commander', minMain: 100, label: 'Commander' })
    expect(tableFormatProfile('Constructed - Pauper', 'Two Player Duel')).toMatchObject({ family: 'constructed', format: 'Pauper', minMain: 60, label: 'Pauper', icon: 'gem' })
    expect(tableFormatProfile('Constructed - Modern - No Banned List', 'Two Player Duel')).toMatchObject({ format: 'Modern' })
    expect(tableFormatProfile('Limited', 'Booster Draft')).toMatchObject({ family: 'limited', minMain: 40 })
    expect(tableFormatProfile('Variant Magic - Brawl', 'Brawl Two Player Duel')).toMatchObject({ family: 'commander', format: 'Brawl', minMain: 60 })
    expect(tableFormatProfile('Variant Magic - Tiny Leaders', 'Tiny Leaders Two Player Duel')).toMatchObject({ family: 'commander', minMain: 50 })
    expect(tableFormatProfile('Constructed - Premodern', 'Two Player Duel')).toMatchObject({ family: 'constructed', format: null, minMain: 60, label: 'Premodern' })
  })

  it('has no minimum for unknown, freeform or Momir tables', () => {
    expect(tableFormatProfile('', '').minMain).toBeNull()
    expect(tableFormatProfile(undefined, undefined).family).toBe('unknown')
    expect(tableFormatProfile('Variant Magic - Momir Basic', 'Momir Basic Two Player Duel')).toMatchObject({ family: 'special', minMain: null })
    expect(tableFormatProfile('Constructed - Freeform', 'Two Player Duel').minMain).toBeNull()
  })
})

describe('deckFitForTable', () => {
  const pauper = tableFormatProfile('Constructed - Pauper', 'Two Player Duel')
  const commander = tableFormatProfile('Variant Magic - Commander', 'Commander Two Player Duel')

  it('prefers decks tagged with the table format', () => {
    expect(deckFitForTable(deck('P', 60, { format: 'Pauper' }), pauper).level).toBe('match')
    expect(deckFitForTable(deck('Legacy60', 60), pauper).level).toBe('ok')
    expect(deckFitForTable(deck('M', 60, { format: 'Modern' }), pauper).level).toBe('other')
    expect(deckFitForTable(deck('Tiny', 40), pauper)).toMatchObject({ level: 'short', count: 40, min: 60 })
  })

  it('treats commander decks by size and commander designation', () => {
    expect(deckFitForTable(deck('EDH', 100, { format: 'Commander' }), commander).level).toBe('match')
    expect(deckFitForTable(deck('Legacy100', 100), commander).level).toBe('ok')
    expect(deckFitForTable(deck('Short', 60), commander).level).toBe('short')
    expect(deckFitForTable(deck('EDH', 100, { format: 'Commander' }), pauper).level).toBe('other')
  })

  it('counts commanders listed outside the main deck', () => {
    const d = deck('Split', 99, { commanders: [card('Atraxa, Praetors\' Voice')] })
    expect(deckFitForTable(d, commander)).toMatchObject({ level: 'ok', count: 100 })
  })
})

describe('rankDecksForTable / pickInitialDeck', () => {
  const pauper = tableFormatProfile('Constructed - Pauper', 'Two Player Duel')
  const decks = [
    deck('Short', 40),
    deck('Modern', 60, { format: 'Modern' }),
    deck('Plain', 60),
    deck('Pauper', 60, { format: 'Pauper' }),
  ]

  it('orders match → ok → other → short', () => {
    expect(rankDecksForTable(decks, pauper).map(({ deck: d }) => d.name)).toEqual(['Pauper', 'Plain', 'Modern', 'Short'])
  })

  it('preselects the last deck used for the format, then the current deck if it fits, then the best fit', () => {
    const ranked = rankDecksForTable(decks, pauper)
    expect(pickInitialDeck(ranked, pauper, null)?.name).toBe('Pauper')
    expect(pickInitialDeck(ranked, pauper, decks[2])?.name).toBe('Plain')
    expect(pickInitialDeck(ranked, pauper, decks[0])?.name).toBe('Pauper')
    rememberDeckForFormat(pauper, decks[1])
    expect(pickInitialDeck(ranked, pauper, decks[2])?.name).toBe('Modern')
    const modern = tableFormatProfile('Constructed - Modern', 'Two Player Duel')
    expect(pickInitialDeck(rankDecksForTable(decks, modern), modern, null)?.name).toBe('Modern')
  })
})

describe('deck presentation helpers', () => {
  it('highlights commanders, else the first non-basic cards', () => {
    expect(deckHighlights(deck('Burn', 60))).toEqual(['Lightning Bolt'])
    expect(deckHighlights(deck('EDH', 100, { commanderCard: card('Krenko, Mob Boss') }))).toEqual(['Krenko, Mob Boss'])
  })

  it('picks a cover: explicit cover, commander, then first non-basic card', () => {
    expect(deckCoverCard(deck('Burn', 60))?.cardName).toBe('Lightning Bolt')
    expect(deckCoverCard(deck('EDH', 100, { commanderCard: card('Krenko, Mob Boss') }))?.cardName).toBe('Krenko, Mob Boss')
    expect(deckCoverCard(deck('Cover', 60, { coverCard: card('Goblin Guide') }))?.cardName).toBe('Goblin Guide')
  })
})
