import type { DeckCard } from '../lobby/decks'
import type { DeckFormat, DeckV2 } from './types'
import { makeDeckId } from './types'
import { parseAnyDeck } from './parseDck'
import { t } from '../i18n'
import { fetchOnlineDeckJson } from '../net/commands'

/**
 * El fetch a Moxfield/Archidekt corre en el proxy (Java), no en el navegador:
 * esas APIs no envían cabeceras CORS que permitan llamarlas desde el origen
 * del cliente web, así que `fetch()` directo siempre falla con "Failed to
 * fetch". Si el proxy no está conectado (`getGateway` lanza), se trata igual
 * que un fallo de red: se devuelve `null` y el caller cae al parser de texto.
 */
async function fetchOnlineDeckData(source: 'moxfield' | 'archidekt', urlOrId: string): Promise<any | null> {
  try {
    const data = await fetchOnlineDeckJson(source, urlOrId)
    return data ?? null
  } catch (e) {
    console.warn(`[onlineDeckService] fetch ${source} vía proxy no disponible:`, e instanceof Error ? e.message : e)
    return null
  }
}

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
  // Sin marcador explícito ("moxfield.com/decks/" o "id=") se asume que
  // urlOrId YA es el id (no se usa un fallback "^" en la alternancia: eso
  // capturaría el prefijo "https" de una URL completa en vez de fallar).
  const match = urlOrId.match(/moxfield\.com\/decks\/([A-Za-z0-9_-]+)|id=([A-Za-z0-9_-]+)/)
  const deckId = match ? match[1] || match[2] : urlOrId.trim()
  if (!deckId) return null

  try {
    const data = await fetchOnlineDeckData('moxfield', deckId)
    if (!data) return null

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
        : formatRaw.toLowerCase() === 'oathbreaker'
        ? 'Oathbreaker'
        : 'Standard'

    const mainCards: DeckCard[] = []
    const sideCards: DeckCard[] = []

    // Commanders / Companions: van al main (convención de la app: el
    // comandante también figura en el main) y además se designan.
    const commanderList: DeckCard[] = []
    if (data.commanders) {
      for (const [, entry] of Object.entries(data.commanders as Record<string, any>)) {
        const card = entry.card || entry
        const commander = {
          cardName: card.name,
          setCode: card.set?.toUpperCase() || 'M10',
          cardNumber: card.cn || card.collector_number || '1',
          amount: entry.quantity || 1,
        }
        commanderList.push(commander)
        mainCards.push(commander)
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
      commanderCard: commanderList[0],
      partnerCard: commanderList[1],
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
  const match = urlOrId.match(/archidekt\.com\/decks\/(\d+)|id=(\d+)/)
  const deckId = match ? match[1] || match[2] : urlOrId.trim()
  if (!deckId) return null

  try {
    const data = await fetchOnlineDeckData('archidekt', deckId)
    if (!data) return null

    const name = data.name || 'Archidekt Deck'
    const mainCards: DeckCard[] = []
    const sideCards: DeckCard[] = []
    const commanderList: DeckCard[] = []

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
          const row = { cardName, setCode, cardNumber, amount }
          mainCards.push(row)
          if (categories.includes('Commander')) commanderList.push(row)
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
      commanderCard: commanderList[0],
      partnerCard: commanderList[1],
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
      // Una sección [Commander]/Commander explícita en el texto manda sobre el
      // conteo: una lista parcial (<99 cartas, p.ej. pegada a medio terminar)
      // con comandante designado seguía cayendo en 'Standard' y perdía las
      // reglas de Commander (singleton, sección de comandante, etc).
      format: (parsed.commanders?.length ?? 0) > 0 || parsed.cards.reduce((s, c) => s + c.amount, 0) >= 99
        ? 'Commander'
        : 'Standard',
      colors: [],
      coverCard: parsed.commanders?.[0] ?? parsed.cards[0],
      // Designación explícita del comandante (sección [Commander]/LAYOUT/etc. del
      // texto importado): sin esto, el mazo quedaba sin comandante marcado hasta
      // que una heurística de "portada = primera carta" lo adivinaba al abrirlo.
      commanderCard: parsed.commanders?.[0],
      partnerCard: parsed.commanders?.[1],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      source: 'imported',
    }
  }

  return null
}
