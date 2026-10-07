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
async function fetchOnlineDeckData<T>(source: 'moxfield' | 'archidekt', urlOrId: string): Promise<T | null> {
  try {
    const data = await fetchOnlineDeckJson(source, urlOrId)
    // the proxy relays the site's JSON untouched: its shape is the site's, read defensively below
    return (data ?? null) as T | null
  } catch (e) {
    console.warn(`[onlineDeckService] fetch ${source} vía proxy no disponible:`, e instanceof Error ? e.message : e)
    return null
  }
}

/** The parts of a Moxfield deck answer read here (an entry is either `{ card, quantity }` or the card itself). */
interface MoxfieldCard {
  name: string
  set?: string
  cn?: string
  collector_number?: string
}
type MoxfieldEntry = MoxfieldCard & { card?: MoxfieldCard; quantity?: number }
type MoxfieldBoard = Record<string, MoxfieldEntry>
interface MoxfieldDeckJson {
  name?: string
  format?: string
  commanders?: MoxfieldBoard
  mainboard?: MoxfieldBoard
  sideboard?: MoxfieldBoard
}

function moxfieldRow(entry: MoxfieldEntry): DeckCard {
  const card = entry.card || entry
  return {
    cardName: card.name,
    setCode: card.set?.toUpperCase() || 'M10',
    cardNumber: card.cn || card.collector_number || '1',
    amount: entry.quantity || 1,
  }
}

/** The parts of an Archidekt deck answer read here. */
interface ArchidektEntry {
  deletedAt?: string | null
  categories?: string[] | null
  quantity?: number
  card?: {
    name?: string
    oracleCard?: { name?: string }
    edition?: { editioncode?: string }
    collectorNumber?: string
  }
}
interface ArchidektDeckJson {
  name?: string
  deckFormat?: unknown
  categories?: unknown
  cards?: ArchidektEntry[]
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
    const data = await fetchOnlineDeckData<MoxfieldDeckJson>('moxfield', deckId)
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
    for (const entry of Object.values(data.commanders ?? {})) {
      const commander = moxfieldRow(entry)
      commanderList.push(commander)
      mainCards.push(commander)
    }
    for (const entry of Object.values(data.mainboard ?? {})) mainCards.push(moxfieldRow(entry))
    for (const entry of Object.values(data.sideboard ?? {})) sideCards.push(moxfieldRow(entry))

    const coverCard = mainCards[0]
    return {
      id: makeDeckId(),
      name,
      format,
      cards: mainCards,
      sideboard: sideCards,
      colors: [],
      coverCard,
      commanders: commanderList.length > 0 ? commanderList : undefined,
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

const ARCHIDEKT_FORMATS: Record<number, DeckFormat> = {
  1: 'Standard',
  2: 'Modern',
  3: 'Commander',
  4: 'Legacy',
  5: 'Vintage',
  6: 'Pauper',
}

const ARCHIDEKT_DEFAULT_EXCLUDED = ['Maybeboard', 'Considering']

/** Archidekt categories flagged `includedInDeck: false` (Maybeboard by
 * default): a card in any of them is not part of the deck. */
export function archidektExcludedCategories(categories: unknown): Set<string> {
  if (!Array.isArray(categories)) return new Set(ARCHIDEKT_DEFAULT_EXCLUDED)
  return new Set(
    categories
      .filter((c): c is { name: string; includedInDeck: false } => !!c && typeof c.name === 'string' && c.includedInDeck === false)
      .map((c) => c.name),
  )
}

export function archidektFormat(deckFormat: unknown, hasCommander: boolean, mainCount: number): DeckFormat {
  const known = typeof deckFormat === 'number' ? ARCHIDEKT_FORMATS[deckFormat] : undefined
  if (known) return known
  return hasCommander || mainCount >= 99 ? 'Commander' : 'Standard'
}

/**
 * Parses and extracts deck from Archidekt API.
 */
export async function fetchArchidektDeck(urlOrId: string): Promise<DeckV2 | null> {
  const match = urlOrId.match(/archidekt\.com\/decks\/(\d+)|id=(\d+)/)
  const deckId = match ? match[1] || match[2] : urlOrId.trim()
  if (!deckId) return null

  try {
    const data = await fetchOnlineDeckData<ArchidektDeckJson>('archidekt', deckId)
    if (!data) return null

    const name = data.name || 'Archidekt Deck'
    const mainCards: DeckCard[] = []
    const sideCards: DeckCard[] = []
    const commanderList: DeckCard[] = []
    const excluded = archidektExcludedCategories(data.categories)

    if (Array.isArray(data.cards)) {
      for (const entry of data.cards) {
        if (entry.deletedAt) continue
        if ((entry.categories || []).some((c) => excluded.has(c))) continue
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
      format: archidektFormat(data.deckFormat, commanderList.length > 0, mainCards.reduce((s, c) => s + c.amount, 0)),
      cards: mainCards,
      sideboard: sideCards,
      colors: [],
      coverCard: mainCards[0],
      commanders: commanderList.length > 0 ? commanderList : undefined,
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
