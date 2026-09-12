import { validateDeck } from '../net/commands'
import type { DeckValidationResult } from '../net/types'

/** Cualquier mazo {name, cards, sideboard} con entradas DeckCard. */
export interface DeckLike {
  name: string
  cards: { cardName: string; setCode: string; cardNumber: string; amount: number }[]
  sideboard: { cardName: string; setCode: string; cardNumber: string; amount: number }[]
}

/**
 * Valida un mazo contra la BD de cartas del proxy (misma release y semántica
 * que el servidor XMage objetivo). Devuelve null si el proxy no pudo validar
 * (sin conexión o BD de cartas no disponible) — la validación es advisory.
 */
export async function fetchDeckIssues(deck: DeckLike): Promise<DeckValidationResult | null> {
  try {
    const report = await validateDeck(deck as never)
    return report && report.ready ? report : null
  } catch (e) {
    console.warn('[deckIssues] validateDeck no disponible:', e instanceof Error ? e.message : e)
    return null
  }
}

/** Clave estable de una entrada de mazo (cardName|setCode|cardNumber). */
export function deckIssueKey(cardName: string, setCode: string, cardNumber: string): string {
  return `${cardName}|${setCode}|${cardNumber}`
}

/** Set de claves con problemas (rechazadas o cargadas como otra carta). */
export function issueKeysFromReport(report: DeckValidationResult): Set<string> {
  const keys = new Set<string>()
  for (const c of report.missing) keys.add(deckIssueKey(c.cardName, c.setCode, c.cardNumber))
  for (const c of report.mismatches) keys.add(deckIssueKey(c.cardName, c.setCode, c.cardNumber))
  return keys
}

export interface DeckPrinting {
  cardName: string
  setCode: string
  cardNumber: string
}

/** Reemplaza la impresión `from` por `to` en main y sideboard (misma cantidad). */
export function applySuggestion<D extends { cards: DeckPrinting[]; sideboard: DeckPrinting[] }>(
  deck: D,
  from: DeckPrinting,
  to: DeckPrinting,
): D {
  const samePrinting = (c: DeckPrinting) =>
    c.cardName === from.cardName && c.setCode === from.setCode && c.cardNumber === from.cardNumber
  const swap = (cards: DeckPrinting[]) =>
    cards.map((c) =>
      samePrinting(c)
        ? { ...c, cardName: to.cardName, setCode: to.setCode, cardNumber: to.cardNumber }
        : c,
    )
  const next: D = { ...deck, cards: swap(deck.cards), sideboard: swap(deck.sideboard) }
  for (const field of ['commanderCard', 'partnerCard', 'coverCard'] as const) {
    const cur = (next as Record<string, unknown>)[field] as DeckPrinting | undefined | null
    if (cur && samePrinting(cur)) {
      ;(next as Record<string, unknown>)[field] = {
        ...cur,
        cardName: to.cardName,
        setCode: to.setCode,
        cardNumber: to.cardNumber,
      }
    }
  }
  return next
}

/** Índice de la entrada con ese nombre marcada como problemática por el servidor (-1 si no hay). */
export function findFlaggedSameName(
  cards: DeckPrinting[],
  flaggedKeys: Set<string>,
  cardName: string,
): number {
  return cards.findIndex(
    (c) => c.cardName === cardName && flaggedKeys.has(deckIssueKey(c.cardName, c.setCode, c.cardNumber)),
  )
}
