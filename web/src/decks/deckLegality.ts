import { useEffect, useRef, useState } from 'react'
import type { DeckV2 } from './types'
import { deckMainCount } from './types'
import type { DeckFormatValidationResult } from '../net/types'
import { FORMAT_CONFIGS, validateDeckForFormat } from './formatRules'
import { commanderCardsFor } from './deckUtils'
import { useDeckMetadata } from './useDeckMetadata'
import { fetchFormatIssues, xmageDeckTypeFor } from './deckIssues'
import { xmageErrorText } from './useDeckValidation'
import { useStore } from '../state/store'

export interface DeckLegality {
  isValid: boolean
  reasons: string[]
  total: number
  minRequired: number
}

const verdicts = new Map<string, DeckFormatValidationResult>()
const inFlight = new Map<string, Promise<DeckFormatValidationResult | null>>()
let queue: Promise<unknown> = Promise.resolve()

const verdictKey = (deck: DeckV2) => `${deck.id}:${deck.updatedAt}:${deck.format}`

function requestVerdict(deck: DeckV2): Promise<DeckFormatValidationResult | null> {
  const key = verdictKey(deck)
  const cached = verdicts.get(key)
  if (cached) return Promise.resolve(cached)
  const pending = inFlight.get(key)
  if (pending) return pending
  const run = queue.then(() => fetchFormatIssues(deck, deck.format))
  queue = run.catch(() => null)
  const tracked = run.then((verdict) => {
    if (verdict) verdicts.set(key, verdict)
    return verdict
  }).finally(() => inFlight.delete(key))
  inFlight.set(key, tracked)
  return tracked
}

export function resetDeckLegalityCacheForTest(): void {
  verdicts.clear()
  inFlight.clear()
  queue = Promise.resolve()
}

export function useDeckLegality(deck: DeckV2 | null): DeckLegality {
  const wsAlive = useStore((s) => s.wsAlive)
  const { metaMap, updateMetaForDeck } = useDeckMetadata()
  const updateMetaRef = useRef(updateMetaForDeck)
  updateMetaRef.current = updateMetaForDeck
  const [verdict, setVerdict] = useState<DeckFormatValidationResult | null>(() => (deck ? verdicts.get(verdictKey(deck)) ?? null : null))

  useEffect(() => {
    if (!deck || !FORMAT_CONFIGS[deck.format]?.hasCommander) return
    const commanders = commanderCardsFor(deck.cards, deck.commanderCard ?? null, deck.partnerCard ?? null, new Map())
    if (commanders.length > 0) updateMetaRef.current(commanders)
  }, [deck])

  useEffect(() => {
    if (!deck) return
    setVerdict(verdicts.get(verdictKey(deck)) ?? null)
    if (!wsAlive || !xmageDeckTypeFor(deck.format)) return
    let alive = true
    void requestVerdict(deck).then((v) => { if (alive && v) setVerdict(v) })
    return () => { alive = false }
  }, [deck, wsAlive])

  const total = deck ? deckMainCount(deck) : 0
  const minRequired = deck ? FORMAT_CONFIGS[deck.format]?.minMain ?? 60 : 0
  if (!deck) return { isValid: true, reasons: [], total, minRequired }
  if (verdict) {
    return {
      isValid: verdict.valid,
      reasons: verdict.valid ? [] : verdict.errors.map((e) => xmageErrorText(e, verdict.validator)),
      total,
      minRequired,
    }
  }
  const report = validateDeckForFormat(deck, metaMap)
  const isValid = !report.issues.some((i) => i.severity === 'error') && total >= minRequired
  return { isValid, reasons: isValid ? [] : report.issues.map((i) => i.message), total, minRequired }
}
