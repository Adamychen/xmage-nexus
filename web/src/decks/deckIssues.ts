import { validateDeck } from '../net/commands'
import type { DeckMismatchCard, DeckMissingCard, DeckValidationResult } from '../net/types'

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
  for (const c of [...report.missing, ...report.mismatches]) {
    for (const p of issuePrintings(c)) keys.add(deckIssueKey(p.cardName, p.setCode, p.cardNumber))
  }
  return keys
}

export interface DeckPrinting {
  cardName: string
  setCode: string
  cardNumber: string
}

type DeckIssue = DeckMissingCard | DeckMismatchCard

/**
 * Every deck printing a report entry stands for: the (normalized) printing the
 * proxy validated plus the raw printings the client actually stored.
 */
export function issuePrintings(issue: DeckIssue): DeckPrinting[] {
  const out: DeckPrinting[] = [{ cardName: issue.cardName, setCode: issue.setCode, cardNumber: issue.cardNumber }]
  for (const s of issue.sources ?? []) {
    if (out.some((p) => p.setCode === s.setCode && p.cardNumber === s.cardNumber)) continue
    out.push({ cardName: issue.cardName, setCode: s.setCode, cardNumber: s.cardNumber })
  }
  return out
}

export interface DeckFix {
  from: DeckPrinting
  to: DeckPrinting
}

/** Fixes that move every deck printing behind `issue` to `to`. */
export function fixesForIssue(issue: DeckIssue, to: DeckPrinting): DeckFix[] {
  const target = { cardName: to.cardName, setCode: to.setCode, cardNumber: to.cardNumber }
  return issuePrintings(issue).map((from) => ({ from, to: target }))
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

/** Applies every `from → to` replacement in order (one-click auto-resolve). */
export function applySuggestions<D extends { cards: DeckPrinting[]; sideboard: DeckPrinting[] }>(
  deck: D,
  fixes: DeckFix[],
): D {
  return fixes.reduce((acc, f) => applySuggestion(acc, f.from, f.to), deck)
}

/** First suggestion of every flagged card that has one (missing + mismatches). */
export function autoResolveFixes(report: DeckValidationResult): DeckFix[] {
  return [...report.missing, ...report.mismatches].flatMap((c) => {
    const s = c.suggestions?.[0]
    return s ? fixesForIssue(c, s) : []
  })
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
