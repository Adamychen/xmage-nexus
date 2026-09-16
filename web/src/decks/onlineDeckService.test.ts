import { describe, it, expect, vi, afterEach } from 'vitest'
import { META_DECK_CATALOG } from './metaDeckCatalog'
import { fetchArchidektDeck, fetchMoxfieldDeck, loadDeckFromOnlineSource } from './onlineDeckService'
import { fetchOnlineDeckJson } from '../net/commands'

// El fetch a Moxfield/Archidekt corre en el proxy (Java), no vía `fetch()` del
// navegador (esas APIs no mandan cabeceras CORS) — ver onlineDeckService.ts.
vi.mock('../net/commands', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../net/commands')>()),
  fetchOnlineDeckJson: vi.fn(),
}))

const mockedFetchOnlineDeckJson = vi.mocked(fetchOnlineDeckJson)

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

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

  it('raw text: designa el comandante desde la sección [Commander]/Commander del texto (AUDIT)', async () => {
    const rawText = `Commander
1 Acererak the Archlich

Deck
1 Agonizing Remorse
19 Snow-Covered Swamp
18 Snow-Covered Swamp
1 Wishclaw Talisman
`
    const deck = await loadDeckFromOnlineSource(rawText, 'Acererak Storm')
    expect(deck).not.toBeNull()
    expect(deck?.commanderCard).toMatchObject({ cardName: 'Acererak the Archlich' })
    expect(deck?.cards.some((c) => c.cardName === 'Acererak the Archlich')).toBe(true)
    expect(deck?.sideboard.some((c) => c.cardName === 'Acererak the Archlich')).toBe(false)
    // Lista parcial (< 99 cartas): sin este fix el conteo por umbral la
    // catalogaba como 'Standard' pese a tener comandante designado (AUDIT).
    expect(deck?.format).toBe('Commander')
  })

  it('moxfield: designa el comandante sin sacarlo del main (AUDIT)', async () => {
    mockedFetchOnlineDeckJson.mockResolvedValueOnce({
      name: 'Sidar+Tana',
      format: 'commander',
      commanders: {
        a: { card: { name: 'Sidar Kondo of Jamuraa', set: 'pc2', cn: '1' }, quantity: 1 },
        b: { card: { name: 'Tana, the Bloodsower', set: 'c16', cn: '56' }, quantity: 1 },
      },
      mainboard: {
        m: { card: { name: 'Forest', set: 'lea', cn: '294' }, quantity: 98 },
      },
      sideboard: {},
    })
    const deck = await fetchMoxfieldDeck('https://moxfield.com/decks/abc')
    expect(mockedFetchOnlineDeckJson).toHaveBeenCalledWith('moxfield', 'abc')
    expect(deck?.commanderCard).toMatchObject({ cardName: 'Sidar Kondo of Jamuraa', setCode: 'PC2' })
    expect(deck?.partnerCard).toMatchObject({ cardName: 'Tana, the Bloodsower', setCode: 'C16' })
    expect(deck?.cards.some((c) => c.cardName === 'Sidar Kondo of Jamuraa')).toBe(true)
  })

  it('archidekt: la categoría Commander designa sin duplicar (AUDIT)', async () => {
    mockedFetchOnlineDeckJson.mockResolvedValueOnce({
      name: 'Atraxa',
      cards: [
        {
          card: { oracleCard: { name: "Atraxa, Praetors' Voice" }, edition: { editioncode: 'c16' }, collectorNumber: '28' },
          quantity: 1,
          categories: ['Commander'],
        },
        {
          card: { oracleCard: { name: 'Forest' }, edition: { editioncode: 'lea' }, collectorNumber: '294' },
          quantity: 99,
          categories: ['Main'],
        },
      ],
    })
    const deck = await fetchArchidektDeck('https://archidekt.com/decks/123')
    expect(mockedFetchOnlineDeckJson).toHaveBeenCalledWith('archidekt', '123')
    expect(deck?.commanderCard).toMatchObject({ cardName: "Atraxa, Praetors' Voice", setCode: 'C16' })
    expect(deck?.partnerCard).toBeUndefined()
    expect(deck?.cards.filter((c) => c.cardName === "Atraxa, Praetors' Voice")).toHaveLength(1)
  })

  it('moxfield: si el proxy no está conectado, degrada a null en vez de lanzar', async () => {
    mockedFetchOnlineDeckJson.mockRejectedValueOnce(new Error('gateway no inicializado'))
    const deck = await fetchMoxfieldDeck('https://moxfield.com/decks/abc')
    expect(deck).toBeNull()
  })
})
