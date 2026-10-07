import { validateDeck, validateDeckFormat } from '../net/commands'
import type { DeckFormatValidationResult, DeckMismatchCard, DeckMissingCard, DeckValidationResult } from '../net/types'
import type { DeckFormat } from './types'

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

/** Formato web -> deckType de config.xml del servidor (null: sin validador en XMage). */
export function xmageDeckTypeFor(format: DeckFormat): string | null {
  switch (format) {
    case 'Standard': return 'Constructed - Standard'
    case 'Modern': return 'Constructed - Modern'
    case 'Pioneer': return 'Constructed - Pioneer'
    case 'Legacy': return 'Constructed - Legacy'
    case 'Vintage': return 'Constructed - Vintage'
    case 'Pauper': return 'Constructed - Pauper'
    case 'Historic': return 'Constructed - Historic'
    case 'Freeform': return 'Constructed - Freeform'
    case 'Commander': return 'Variant Magic - Commander'
    case 'Brawl': return 'Variant Magic - Brawl'
    case 'Oathbreaker': return 'Variant Magic - Oathbreaker'
    case 'PennyDreadfulCommander': return 'Variant Magic - Penny Dreadful Commander'
    case 'EuropeanHighlander': return 'Constructed - European Highlander'
    case 'CanadianHighlander': return 'Constructed - Canadian Highlander'
    default: return null // Timeless y demás sin equivalente en XMage
  }
}

/**
 * Valida el mazo con el DeckValidator OFICIAL de XMage (misma release que el
 * servidor objetivo): tamaños, bans, comandante/partner, identidad de color.
 * Devuelve null si el proxy no pudo validar (sin conexión, BD no disponible o
 * formato sin validador) — advisory, nunca bloqueante.
 */
export async function fetchFormatIssues(deck: DeckLike, format: DeckFormat): Promise<DeckFormatValidationResult | null> {
  try {
    const deckType = xmageDeckTypeFor(format)
    if (!deckType) return null
    const report = await validateDeckFormat(deck as never, deckType)
    return report && report.ready && report.supported ? report : null
  } catch (e) {
    console.warn('[deckIssues] validateDeckFormat no disponible:', e instanceof Error ? e.message : e)
    return null
  }
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
