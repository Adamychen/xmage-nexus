import type { DeckCard } from '../lobby/decks'
import { BASIC_LAND_PRESETS, withCommanderFirst } from './deckUtils'

const BASIC_LAND_PRESET_BY_NAME = new Map(BASIC_LAND_PRESETS.map((p) => [p.name, p]))

/**
 * Rellena la impresión de una básica que llega sin ella (listas de texto plano:
 * Arena/.dek/.cod/.o8d/mtgjson sin `code`).
 *
 * Es lo ÚNICO que normaliza el cliente. La normalización de impresiones para el
 * servidor (PLST "ORI-123" → ORI #123, sufijos promo "123p"/"123★", sets "P…"
 * de promos) y la impresión por nombre de cualquier carta sin ella las hace el
 * proxy en el borde del protocolo (`DeckJson.resolvePrinting`, con la BD de
 * cartas de XMage), así que el mazo guardado conserva la impresión de Scryfall
 * tal cual. Esto queda como respaldo para cuando el proxy aún no tiene su BD
 * lista: una básica sin impresión sería "Card not found" en el servidor real.
 */
export function normalizeDeckCard(card: DeckCard): DeckCard {
  if (card.setCode.trim() || card.cardNumber.trim()) return card
  const preset = BASIC_LAND_PRESET_BY_NAME.get(card.cardName)
  return preset ? { ...card, setCode: preset.setCode, cardNumber: preset.cardNumber } : card
}

export function normalizeDeckCards(cards: DeckCard[]): DeckCard[] {
  return cards.map(normalizeDeckCard)
}

export function isCommanderFormat(deckType?: string, gameType?: string): boolean {
  const d = (deckType ?? '').toLowerCase()
  const g = (gameType ?? '').toLowerCase()
  return d.includes('commander') || g.includes('commander')
}

export function prepareDeckForXMage(
  deck: {
    name: string
    cards: DeckCard[]
    sideboard: DeckCard[]
    commanderCard?: DeckCard
    partnerCard?: DeckCard
  },
  deckType?: string,
  gameType?: string,
): { name: string; cards: DeckCard[]; sideboard: DeckCard[]; commanders?: DeckCard[] } {
  // Transformación invisible: el usuario ve los comandantes en el main,
  // XMage los exige en el banquillo (99 + comandantes). El proxy hace la
  // normalización autoritativa con CardRepository (DeckValidation.normalizeForXMage)
  // y además honra los comandantes designados explícitamente (1 o 2 parejas
  // legales: Partner, Trasfondo…). Si no hay designación, el proxy mantiene su
  // heurística de primera carta legal. No tocamos storage.
  //
  // Punto único de paso antes de enviar cualquier mazo (join/create/espectador/
  // asiento SIM): rellena impresiones de básicas ausentes (setCode/cardNumber
  // vacíos) para mazos ya guardados desde antes de este fix, sin depender de
  // volver a pasar por el importador de texto.
  const normalized = {
    ...deck,
    cards: normalizeDeckCards(deck.cards),
    sideboard: normalizeDeckCards(deck.sideboard),
  }
  const commanders: DeckCard[] = []
  if (deck.commanderCard) commanders.push(deck.commanderCard)
  if (deck.partnerCard && !sameCommanderKey(deck.partnerCard, deck.commanderCard)) {
    commanders.push(deck.partnerCard)
  }
  if (commanders.length === 0 || !isCommanderFormat(deckType, gameType)) {
    return normalized
  }
  return {
    ...normalized,
    cards: withCommanderFirst(normalized.cards, deck.commanderCard, deck.partnerCard),
    commanders,
  }
}

function sameCommanderKey(a: DeckCard, b?: DeckCard): boolean {
  if (!b) return false
  return a.cardName === b.cardName && a.setCode === b.setCode && a.cardNumber === b.cardNumber
}
