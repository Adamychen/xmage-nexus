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

function derivePromoBase(setCode: string): string | null {
  const u = setCode.trim().toUpperCase()
  if (u === 'PLST') return null
  if (u.length >= 3 && u.charAt(0) === 'P') {
    const base = u.substring(1)
    if (/^[A-Z0-9]{2,4}$/.test(base)) return base
  }
  return null
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

  const derived = derivePromoBase(rawSet)
  if (derived) {
    rawSet = derived
  }

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
