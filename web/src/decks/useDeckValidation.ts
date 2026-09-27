import { useMemo } from 'react'
import type { DeckV2 } from './types'
import type { CardStripMeta } from './ArenaCardStrip'
import type { DeckValidationResult } from '../net/types'
import { validateDeckForFormat, type ValidationIssue } from './formatRules'
import { deckIssueKey, fixesForIssue, issueKeysFromReport, issuePrintings, type DeckFix } from './deckIssues'
import { useTranslation } from '../i18n'

export interface ServerIssueItem {
  kind: 'missing' | 'mismatch'
  name: string
  set: string
  num: string
  amount: number
  message: string
  to?: { cardName: string; setCode: string; cardNumber: string }
  fixes: DeckFix[]
}

/** Validación de formato local + fusión con los issues del servidor. */
export function useDeckValidation(
  deck: DeckV2 | null,
  metaMap: Map<string, CardStripMeta>,
  serverIssues: DeckValidationResult | null,
  format: DeckV2['format'],
) {
  const { t } = useTranslation()

  const validationReport = useMemo(() => {
    if (!deck) return { isValid: true, issues: [], cardIssues: new Map() }
    return validateDeckForFormat(deck, metaMap)
  }, [deck, metaMap, format])

  const mergedCardIssues = useMemo(() => {
    const merged = new Map(validationReport.cardIssues)
    if (!serverIssues || !deck) return merged
    const missByKey = new Map<string, (typeof serverIssues.missing)[number]>()
    const misByKey = new Map<string, (typeof serverIssues.mismatches)[number]>()
    for (const m of serverIssues.missing) {
      for (const p of issuePrintings(m)) missByKey.set(deckIssueKey(p.cardName, p.setCode, p.cardNumber), m)
    }
    for (const m of serverIssues.mismatches) {
      for (const p of issuePrintings(m)) misByKey.set(deckIssueKey(p.cardName, p.setCode, p.cardNumber), m)
    }
    const addIssue = (card: { cardName: string; setCode: string; cardNumber: string }, message: string) => {
      const issue: ValidationIssue = { type: 'server_issue', message, severity: 'error', cardName: card.cardName }
      merged.set(`${card.setCode}:${card.cardNumber}:${card.cardName}`, issue)
    }
    for (const c of [...deck.cards, ...deck.sideboard]) {
      const key = deckIssueKey(c.cardName, c.setCode, c.cardNumber)
      const miss = missByKey.get(key)
      const mis = misByKey.get(key)
      if (miss) {
        addIssue(c, miss.reason === 'OUTDATED_PRINTING' ? t('decks', 'issues_reason_outdated') : t('decks', 'issues_reason_unimplemented'))
      } else if (mis) {
        addIssue(c, t('decks', 'issues_mismatch_resolved', { resolved: mis.resolvedName }))
      }
    }
    return merged
  }, [validationReport, serverIssues, deck, t])

  const serverFlaggedKeys = useMemo(
    () => (serverIssues ? issueKeysFromReport(serverIssues) : new Set<string>()),
    [serverIssues],
  )

  const serverIssueList: ServerIssueItem[] = useMemo(() => {
    if (!serverIssues) return []
    const out: ServerIssueItem[] = []
    for (const m of serverIssues.missing) {
      const sug = m.suggestions?.[0]
      out.push({
        kind: 'missing',
        name: m.cardName,
        set: m.setCode,
        num: m.cardNumber,
        amount: m.amount,
        message: m.reason === 'OUTDATED_PRINTING' ? t('decks', 'issues_reason_outdated') : t('decks', 'issues_reason_unimplemented'),
        to: sug ? { cardName: sug.cardName, setCode: sug.setCode, cardNumber: sug.cardNumber } : undefined,
        fixes: sug ? fixesForIssue(m, sug) : [],
      })
    }
    for (const m of serverIssues.mismatches) {
      const sug = m.suggestions?.[0]
      out.push({
        kind: 'mismatch',
        name: m.cardName,
        set: m.setCode,
        num: m.cardNumber,
        amount: m.amount,
        message: t('decks', 'issues_mismatch_resolved', { resolved: m.resolvedName }),
        to: sug ? { cardName: sug.cardName, setCode: sug.setCode, cardNumber: sug.cardNumber } : undefined,
        fixes: sug ? fixesForIssue(m, sug) : [],
      })
    }
    return out
  }, [serverIssues, t])

  return { validationReport, mergedCardIssues, serverFlaggedKeys, serverIssueList }
}
