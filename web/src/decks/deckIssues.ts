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
  } catch {
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
