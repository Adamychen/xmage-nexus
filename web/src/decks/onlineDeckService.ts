import type { DeckCard } from '../lobby/decks'
import type { DeckFormat, DeckV2 } from './types'
import { makeDeckId } from './types'
import { parseAnyDeck } from './parseDck'
import { t } from '../i18n'

export interface OnlineDeckSummary {
  id: string
  name: string
  format: DeckFormat
  author: string
  coverCardName: string
  colors: ('W' | 'U' | 'B' | 'R' | 'G')[]
  cardCount: number
  source: 'Moxfield' | 'Archidekt' | 'MTGGoldfish' | 'Custom'
  url: string
}

/**
 * Parses and extracts deck from Moxfield API response.
 */
export async function fetchMoxfieldDeck(urlOrId: string): Promise<DeckV2 | null> {
  const match = urlOrId.match(/(?:moxfield\.com\/decks\/|id=|^)([A-Za-z0-9_-]+)/)
  const deckId = match ? match[1] : urlOrId.trim()
  if (!deckId) return null

  try {
    const res = await fetch(`https://api.moxfield.com/v2/decks/all/${deckId}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    const data = await res.json()

    const name = data.name || 'Moxfield Deck'
    const formatRaw = (data.format || 'Standard') as string
    const format: DeckFormat =
      formatRaw.toLowerCase() === 'commander' || formatRaw.toLowerCase() === 'edh'
        ? 'Commander'
        : formatRaw.toLowerCase() === 'modern'
        ? 'Modern'
        : formatRaw.toLowerCase() === 'pioneer'
        ? 'Pioneer'
        : formatRaw.toLowerCase() === 'pauper'
        ? 'Pauper'
        : 'Standard'

    const mainCards: DeckCard[] = []
    const sideCards: DeckCard[] = []

    // Commanders / Companions
    if (data.commanders) {
      for (const [, entry] of Object.entries(data.commanders as Record<string, any>)) {
        const card = entry.card || entry
        mainCards.push({
          cardName: card.name,
          setCode: card.set?.toUpperCase() || 'M10',
          cardNumber: card.cn || card.collector_number || '1',
          amount: entry.quantity || 1,
        })
      }
    }

    // Mainboard
    if (data.mainboard) {
      for (const [, entry] of Object.entries(data.mainboard as Record<string, any>)) {
        const card = entry.card || entry
        mainCards.push({
          cardName: card.name,
          setCode: card.set?.toUpperCase() || 'M10',
          cardNumber: card.cn || card.collector_number || '1',
          amount: entry.quantity || 1,
        })
      }
    }

    // Sideboard
    if (data.sideboard) {
      for (const [, entry] of Object.entries(data.sideboard as Record<string, any>)) {
        const card = entry.card || entry
        sideCards.push({
          cardName: card.name,
          setCode: card.set?.toUpperCase() || 'M10',
          cardNumber: card.cn || card.collector_number || '1',
          amount: entry.quantity || 1,
        })
      }
    }

    const coverCard = mainCards[0]
    return {
      id: makeDeckId(),
      name,
      format,
      cards: mainCards,
      sideboard: sideCards,
      colors: [],
      coverCard,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      source: 'imported',
    }
  } catch {
    return null
  }
}

/**
 * Parses and extracts deck from Archidekt API.
 */
export async function fetchArchidektDeck(urlOrId: string): Promise<DeckV2 | null> {
  const match = urlOrId.match(/(?:archidekt\.com\/decks\/|id=|^)(\d+)/)
  const deckId = match ? match[1] : urlOrId.trim()
  if (!deckId) return null

  try {
    const res = await fetch(`https://archidekt.com/api/decks/${deckId}/small/`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    const data = await res.json()

    const name = data.name || 'Archidekt Deck'
    const mainCards: DeckCard[] = []
    const sideCards: DeckCard[] = []

    if (Array.isArray(data.cards)) {
      for (const entry of data.cards) {
        const cardName = entry.card?.oracleCard?.name || entry.card?.name
        if (!cardName) continue
        const setCode = entry.card?.edition?.editioncode?.toUpperCase() || 'M10'
        const cardNumber = entry.card?.collectorNumber || '1'
        const amount = entry.quantity || 1
        const categories = entry.categories || []

        if (categories.includes('Sideboard')) {
          sideCards.push({ cardName, setCode, cardNumber, amount })
        } else {
          mainCards.push({ cardName, setCode, cardNumber, amount })
        }
      }
    }

    return {
      id: makeDeckId(),
      name,
      format: mainCards.reduce((s, c) => s + c.amount, 0) >= 99 ? 'Commander' : 'Standard',
      cards: mainCards,
      sideboard: sideCards,
      colors: [],
      coverCard: mainCards[0],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      source: 'imported',
    }
  } catch {
    return null
  }
}

/**
 * Universal online deck loader: accepts URL (Moxfield, Archidekt, MTGGoldfish) or raw text.
 */
export async function loadDeckFromOnlineSource(input: string, customName?: string): Promise<DeckV2 | null> {
  const trimmed = input.trim()
  if (!trimmed) return null

  // 1. Moxfield URL
  if (trimmed.includes('moxfield.com/decks/')) {
    const mox = await fetchMoxfieldDeck(trimmed)
    if (mox) return mox
  }

  // 2. Archidekt URL
  if (trimmed.includes('archidekt.com/decks/')) {
    const arch = await fetchArchidektDeck(trimmed)
    if (arch) return arch
  }

  // 3. Raw Deck text (Arena, MTGO, .dck, Plain text)
  const parsed = parseAnyDeck(trimmed, customName || t('decks', 'import_placeholder'))
  if (parsed && (parsed.cards.length > 0 || parsed.sideboard.length > 0)) {
    return {
      ...parsed,
      id: makeDeckId(),
      format: parsed.cards.reduce((s, c) => s + c.amount, 0) >= 99 ? 'Commander' : 'Standard',
      colors: [],
      coverCard: parsed.cards[0],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      source: 'imported',
    }
  }

  return null
}
