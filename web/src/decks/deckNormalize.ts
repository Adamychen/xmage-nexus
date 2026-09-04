import type { DeckCard } from '../lobby/decks'

function stripPromoSuffix(num: string): string {
  const t = num.trim()
  if (/^\d+[a-z]*[p★]$/i.test(t) && t.length > 1) {
    const without = t.replace(/[p★]$/i, '')
    if (/^\d/.test(without)) return without
  }
  return t
}

function stripPrefixedNumber(num: string): string {
  if (!num.includes('-')) return num
  if (/^[A-Z0-9]+-\d+[a-z★*+]*$/i.test(num)) {
    const parts = num.split('-')
    const last = parts.pop()!.trim()
    if (last) return last
  }
  const last = num.split('-').pop()!.trim()
  return last || num
}

export function normalizeDeckCard(card: DeckCard): DeckCard {
  let { setCode, cardNumber } = card
  let rawSet = setCode.trim()
  let rawNum = cardNumber.trim()
  const upperSet = rawSet.toUpperCase()

  if (upperSet === 'PLST' && rawNum.includes('-')) {
    const parts = rawNum.split('-')
    const num = parts.pop()!.trim()
    const origSet = parts[0]?.trim() || ''
    if (origSet && num) {
      rawSet = origSet.toUpperCase()
      rawNum = stripPromoSuffix(num)
      return { ...card, setCode: rawSet, cardNumber: rawNum }
    }
  }

  if (rawNum.includes('-')) {
    rawNum = stripPrefixedNumber(rawNum)
  }
  rawNum = stripPromoSuffix(rawNum)

  // NOTA: no se elimina el prefijo "P" de sets promo en el cliente: el proxy
  // decide en el borde del protocolo si es un promo real (base existente y
  // original inexistente). Quitar P aquí mutilaba sets reales (PCY, PRO, PC2)
  // y rompía validateDeck en bucle (PCY -> CY -> PCY -> ...).

  if (rawSet !== setCode.trim() || rawNum !== cardNumber.trim()) {
    return { ...card, setCode: rawSet.toUpperCase(), cardNumber: rawNum }
  }
  if (rawNum !== cardNumber.trim()) {
    return { ...card, cardNumber: rawNum }
  }
  return card
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
  deck: { name: string; cards: DeckCard[]; sideboard: DeckCard[] },
  deckType?: string,
  gameType?: string,
): { name: string; cards: DeckCard[]; sideboard: DeckCard[] } {
  // Transformación invisible: el usuario ve 100 en main + comandante como portada,
  // XMage exige 99+1 (comandante en banquillo). El proxy hace la normalización
  // autoritativa con CardRepository (DeckValidation.normalizeForXMage) usando
  // deckType/gameType, así que aquí solo preservamos el deck tal cual y
  // dejamos que el proxy elija el comandante correcto (legendaria criatura,
  // CanBeYourCommanderAbility, partners, etc.). No tocamos storage.
  void deckType
  void gameType
  return deck
}
