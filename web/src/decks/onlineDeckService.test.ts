import { describe, it, expect } from 'vitest'
import { META_DECK_CATALOG } from './metaDeckCatalog'
import { loadDeckFromOnlineSource } from './onlineDeckService'

describe('DeckBrowser & OnlineDeckService', () => {
  it('loads curated meta decks with complete cards and sideboards', () => {
    expect(META_DECK_CATALOG.length).toBeGreaterThan(5)

    const murktide = META_DECK_CATALOG.find((d) => d.name === 'Izzet Murktide')
    expect(murktide).toBeDefined()
    expect(murktide?.format).toBe('Modern')
    expect(murktide?.cards.reduce((s, c) => s + c.amount, 0)).toBe(60)
    expect(murktide?.sideboard.reduce((s, c) => s + c.amount, 0)).toBe(15)

    const atraxa = META_DECK_CATALOG.find((d) => d.id === 'meta-edh-atraxa')
    expect(atraxa).toBeDefined()
    expect(atraxa?.format).toBe('Commander')
  })

  it('parses raw deck text through universal online loader', async () => {
    const rawText = `
Deck
4 Lightning Bolt (M10) 146
4 Monastery Swiftspear (BRO) 144
20 Mountain (LEA) 292
Sideboard
3 Smash to Smithereens (ORI) 163
`
    const deck = await loadDeckFromOnlineSource(rawText, 'Burn Test')
    expect(deck).not.toBeNull()
    expect(deck?.name).toBe('Burn Test')
    expect(deck?.cards.reduce((s, c) => s + c.amount, 0)).toBe(28)
    expect(deck?.sideboard.reduce((s, c) => s + c.amount, 0)).toBe(3)
  })

  it('handles empty input gracefully', async () => {
    const deck = await loadDeckFromOnlineSource('')
    expect(deck).toBeNull()
  })
})
