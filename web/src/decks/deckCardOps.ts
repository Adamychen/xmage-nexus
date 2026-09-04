import type { DeckCard } from '../lobby/decks'
import { normalizeDeckCard } from './deckNormalize'
import type { ScryfallSearchCard } from './scryfallSearch'
import { scryfallCardArtCrop, scryfallCardImage, scryfallCardBackImage } from './scryfallSearch'
import type { CardStripMeta } from './ArenaCardStrip'
import { BASIC_LAND_PRESETS } from './deckUtils'
import { findFlaggedSameName } from './deckIssues'

export function deckCardKey(c: DeckCard): string {
  return `${c.setCode}:${c.cardNumber}:${c.cardName}`
}

/** Mueve una copia de `from` a `to` (swap main<->sideboard, drag&drop entre zonas). */
export function moveOneBetween(from: DeckCard[], to: DeckCard[], key: string): [DeckCard[], DeckCard[]] {
  const idx = from.findIndex((c) => deckCardKey(c) === key)
  if (idx < 0) return [from, to]
  const card = from[idx]
  const nextFrom = card.amount <= 1
    ? from.filter((_, i) => i !== idx)
    : from.map((c, i) => (i === idx ? { ...c, amount: c.amount - 1 } : c))
  const toIdx = to.findIndex((c) => deckCardKey(c) === key)
  const nextTo = toIdx >= 0
    ? to.map((c, i) => (i === toIdx ? { ...c, amount: Math.min(99, c.amount + 1) } : c))
    : [...to, { ...card, amount: 1 }]
  return [nextFrom, nextTo]
}

export function incrementInList(list: DeckCard[], key: string): DeckCard[] {
  return list.map((c) => (deckCardKey(c) === key ? { ...c, amount: Math.min(99, c.amount + 1) } : c))
}

export function decrementInList(list: DeckCard[], key: string): DeckCard[] {
  return list.flatMap((c) =>
    deckCardKey(c) === key ? (c.amount <= 1 ? [] : [{ ...c, amount: c.amount - 1 }]) : [c]
  )
}

export function removeFromList(list: DeckCard[], key: string): DeckCard[] {
  return list.filter((c) => deckCardKey(c) !== key)
}

/** Fusiona cartas importadas en la lista (suma cantidades, tope 99). */
export function mergeIntoList(base: DeckCard[], incoming: DeckCard[]): DeckCard[] {
  const merged: DeckCard[] = [...base]
  for (const c of incoming) {
    const k = deckCardKey(c)
    const idx = merged.findIndex((x) => deckCardKey(x) === k)
    if (idx >= 0) {
      merged[idx] = { ...merged[idx], amount: Math.min(99, merged[idx].amount + c.amount) }
    } else {
      merged.push(c)
    }
  }
  return merged
}

export interface DroppedCard {
  cardName: string
  setCode: string
  cardNumber: string
}

/**
 * Inserta una carta arrastrada/soltada en la lista: si hay una entrada con el
 * mismo nombre marcada por el servidor, reemplaza su impresión; si ya existe
 * la misma impresión, suma 1; si no, la añade.
 */
export function insertOrIncrement(
  list: DeckCard[],
  card: DroppedCard,
  flaggedKeys: Set<string>,
): { list: DeckCard[]; replacedOldKey: string | null } {
  const key = `${card.setCode}:${card.cardNumber}:${card.cardName}`
  const flaggedIdx = findFlaggedSameName(list, flaggedKeys, card.cardName)
  if (flaggedIdx >= 0) {
    const oldKey = deckCardKey(list[flaggedIdx])
    const next = list.map((c, i) =>
      (i === flaggedIdx ? { ...c, cardName: card.cardName, setCode: card.setCode, cardNumber: card.cardNumber } : c)
    )
    return { list: next, replacedOldKey: oldKey }
  }
  const existingIdx = list.findIndex((c) => deckCardKey(c) === key)
  if (existingIdx >= 0) {
    return { list: incrementInList(list, key), replacedOldKey: null }
  }
  return { list: [...list, { ...card, amount: 1 }], replacedOldKey: null }
}

/** Añade un resultado de búsqueda (normaliza set/número y suma si ya existe). */
export function addSearchResult(
  cards: DeckCard[], search: ScryfallSearchCard,
): { cards: DeckCard[]; card: DeckCard } {
  const raw = normalizeDeckCard({ cardName: search.name, setCode: search.set.toUpperCase(), cardNumber: search.collector_number, amount: 1 })
  const key = deckCardKey(raw)
  const existingIdx = cards.findIndex((c) => deckCardKey(c) === key)
  if (existingIdx >= 0) {
    return { cards: incrementInList(cards, key), card: raw }
  }
  const card = { cardName: raw.cardName, setCode: raw.setCode, cardNumber: raw.cardNumber, amount: 1 }
  return { cards: [...cards, card], card }
}

/** Cambia la impresión de una carta en main y sideboard (conserva cantidades). */
export function applyPrinting(
  cards: DeckCard[],
  sideboard: DeckCard[],
  target: DeckCard,
  setCode: string,
  cardNumber: string,
): { cards: DeckCard[]; sideboard: DeckCard[]; printing: { setCode: string; cardNumber: string } } {
  const norm = normalizeDeckCard({ cardName: target.cardName, setCode, cardNumber, amount: 1 })
  const printing = { setCode: norm.setCode, cardNumber: norm.cardNumber }
  const oldKey = deckCardKey(target)
  const update = (c: DeckCard) => (deckCardKey(c) === oldKey ? { ...c, ...printing } : c)
  return { cards: cards.map(update), sideboard: sideboard.map(update), printing }
}

export interface SuggestedLand {
  name: string
  setCode: string
  cardNumber: string
  amount: number
}

/** Reemplaza las tierras básicas por la base de maná sugerida. */
export function replaceBasicLands(cards: DeckCard[], suggested: SuggestedLand[]): DeckCard[] {
  const basicNames = new Set(BASIC_LAND_PRESETS.map((p) => p.name.toLowerCase()))
  const nonBasicCards = cards.filter((c) => !basicNames.has(c.cardName.toLowerCase()))
  return [...nonBasicCards, ...suggested.map((s) => ({
    cardName: s.name,
    setCode: s.setCode,
    cardNumber: s.cardNumber,
    amount: s.amount,
  }))]
}

/** Meta de tira construida desde un resultado de búsqueda de Scryfall. */
export function stripMetaFromSearch(card: ScryfallSearchCard): CardStripMeta {
  return {
    artCropUrl: scryfallCardArtCrop(card),
    imageUrl: scryfallCardImage(card),
    backImageUrl: scryfallCardBackImage(card),
    manaCost: card.mana_cost ?? '',
    cmc: card.cmc ?? 0,
    typeLine: card.printed_type_line ?? card.type_line ?? '',
    colors: card.colors || card.color_identity || [],
    legalities: card.legalities,
  }
}

export interface ScryfallJson {
  printed_name?: string
  mana_cost?: string
  cmc?: number
  type_line?: string
  printed_type_line?: string
  colors?: string[]
  color_identity?: string[]
  legalities?: CardStripMeta['legalities']
  image_uris?: { art_crop?: string; normal?: string }
  card_faces?: {
    printed_name?: string
    mana_cost?: string
    type_line?: string
    image_uris?: { art_crop?: string; normal?: string }
  }[]
}

/** Meta de tira construida desde el JSON de la API de Scryfall. */
export function stripMetaFromJson(data: ScryfallJson): CardStripMeta {
  return {
    artCropUrl: data.image_uris?.art_crop ?? data.card_faces?.[0]?.image_uris?.art_crop ?? null,
    imageUrl: data.image_uris?.normal ?? data.card_faces?.[0]?.image_uris?.normal ?? null,
    backImageUrl: data.card_faces?.[1]?.image_uris?.normal ?? null,
    manaCost: data.mana_cost ?? data.card_faces?.[0]?.mana_cost ?? '',
    cmc: data.cmc ?? 0,
    typeLine: data.printed_type_line ?? data.type_line ?? data.card_faces?.[0]?.type_line ?? '',
    colors: data.colors ?? data.color_identity ?? [],
    legalities: data.legalities,
  }
}
