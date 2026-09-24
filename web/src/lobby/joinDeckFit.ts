import type { Deck } from './decks'
import { deckRef } from './decks'
import type { DeckFormat, DeckV2 } from '../decks/types'
import { FORMAT_CONFIGS, isBasicOrUnlimited, isLimitedDeckType } from '../decks/formatRules'
import type { IconName } from '../ui/Icon'

export type TableFamily = 'commander' | 'constructed' | 'limited' | 'special' | 'unknown'

export interface TableFormatProfile {
  key: string
  family: TableFamily
  format: DeckFormat | null
  label: string
  icon: IconName
  minMain: number | null
}

export type DeckFitLevel = 'match' | 'ok' | 'other' | 'short'

export interface DeckFit {
  level: DeckFitLevel
  count: number
  min: number | null
  deckFormat: DeckFormat | null
}

export type JoinDeck = Deck & Partial<Pick<DeckV2, 'format' | 'colors' | 'coverCard' | 'commanderCard' | 'partnerCard' | 'updatedAt' | 'favorite'>>

const CONSTRUCTED_FORMATS: Array<[RegExp, DeckFormat]> = [
  [/\bstandard\b/, 'Standard'],
  [/\bpioneer\b/, 'Pioneer'],
  [/\bmodern\b/, 'Modern'],
  [/\blegacy\b/, 'Legacy'],
  [/\bvintage\b/, 'Vintage'],
  [/\bpauper\b/, 'Pauper'],
  [/\bhistoric\b/, 'Historic'],
  [/\btimeless\b/, 'Timeless'],
  [/\bcanadian highlander\b/, 'CanadianHighlander'],
  [/\beuropean highlander\b/, 'EuropeanHighlander'],
  [/\bfreeform\b/, 'Freeform'],
]

const COMMANDER_FORMATS = new Set<DeckFormat>(['Commander', 'Brawl', 'Oathbreaker', 'PennyDreadfulCommander'])

function shortLabel(deckType: string): string {
  return deckType.replace(/^(Block Constructed|Constructed|Variant Magic) - /, '').trim()
}

export function tableFormatProfile(deckType?: string, gameType?: string): TableFormatProfile {
  const raw = (deckType ?? '').trim()
  const dt = raw.toLowerCase()
  const gt = (gameType ?? '').toLowerCase()
  const label = shortLabel(raw)

  if (!dt && !gt) return { key: '', family: 'unknown', format: null, label: '', icon: 'globe', minMain: null }
  if (dt.includes('momir')) return { key: raw, family: 'special', format: null, label, icon: 'dice', minMain: null }
  if (isLimitedDeckType(deckType)) return { key: raw, family: 'limited', format: null, label, icon: 'package', minMain: 40 }
  if (dt.includes('tiny leaders')) return { key: raw, family: 'commander', format: null, label, icon: 'crown', minMain: 50 }
  if (dt.includes('oathbreaker')) return { key: 'Oathbreaker', family: 'commander', format: 'Oathbreaker', label, icon: 'crown', minMain: 60 }
  if (dt.includes('brawl')) return { key: 'Brawl', family: 'commander', format: 'Brawl', label, icon: 'crown', minMain: 60 }
  if (dt.includes('penny dreadful commander')) {
    return { key: 'PennyDreadfulCommander', family: 'commander', format: 'PennyDreadfulCommander', label, icon: 'crown', minMain: 100 }
  }
  if (dt.includes('commander') || gt.includes('commander')) {
    return { key: 'Commander', family: 'commander', format: 'Commander', label: label || 'Commander', icon: 'crown', minMain: 100 }
  }
  for (const [re, format] of CONSTRUCTED_FORMATS) {
    if (re.test(dt)) {
      const min = format === 'Freeform' ? null : FORMAT_CONFIGS[format].minMain
      return { key: format, family: 'constructed', format, label, icon: format === 'Pauper' ? 'gem' : 'zap', minMain: min }
    }
  }
  if (dt.startsWith('constructed') || dt.startsWith('block constructed')) {
    return { key: raw, family: 'constructed', format: null, label, icon: 'zap', minMain: 60 }
  }
  return { key: raw, family: 'unknown', format: null, label, icon: 'globe', minMain: null }
}

export function deckMainSize(deck: Deck): number {
  const main = deck.cards.reduce((s, c) => s + c.amount, 0)
  const names = new Set(deck.cards.map((c) => c.cardName.toLowerCase()))
  const extra = (deck.commanders ?? []).filter((c) => !names.has(c.cardName.toLowerCase()))
  return main + extra.reduce((s, c) => s + c.amount, 0)
}

export function deckFitForTable(deck: JoinDeck, profile: TableFormatProfile): DeckFit {
  const count = deckMainSize(deck)
  const deckFormat = deck.format ?? null
  const min = profile.minMain
  if (min == null) return { level: 'ok', count, min, deckFormat }
  if (count < min) return { level: 'short', count, min, deckFormat }
  if (profile.format && deckFormat === profile.format) return { level: 'match', count, min, deckFormat }
  const deckIsCommander = (deckFormat != null && COMMANDER_FORMATS.has(deckFormat)) || (deck.commanders?.length ?? 0) > 0 || deck.commanderCard != null
  if (profile.family === 'commander') {
    return { level: deckIsCommander || deckFormat == null ? 'ok' : 'other', count, min, deckFormat }
  }
  if (deckFormat && deckFormat !== 'Freeform' && profile.format && profile.family === 'constructed') {
    return { level: 'other', count, min, deckFormat }
  }
  if (deckIsCommander && profile.family === 'constructed') return { level: 'other', count, min, deckFormat }
  return { level: 'ok', count, min, deckFormat }
}

const LEVEL_RANK: Record<DeckFitLevel, number> = { match: 0, ok: 1, other: 2, short: 3 }

export function isGoodFit(fit: DeckFit): boolean {
  return fit.level === 'match' || fit.level === 'ok'
}

export function rankDecksForTable<D extends JoinDeck>(decks: D[], profile: TableFormatProfile): Array<{ deck: D; fit: DeckFit }> {
  return decks
    .map((deck, i) => ({ deck, fit: deckFitForTable(deck, profile), i }))
    .sort((a, b) =>
      LEVEL_RANK[a.fit.level] - LEVEL_RANK[b.fit.level]
      || Number(!!b.deck.favorite) - Number(!!a.deck.favorite)
      || (b.deck.updatedAt ?? 0) - (a.deck.updatedAt ?? 0)
      || a.i - b.i)
    .map(({ deck, fit }) => ({ deck, fit }))
}

export function deckHighlights(deck: JoinDeck, max = 2): string[] {
  const commanders = [deck.commanderCard, deck.partnerCard, ...(deck.commanders ?? [])]
    .filter((c): c is NonNullable<typeof c> => !!c)
    .map((c) => c.cardName)
  if (commanders.length) return [...new Set(commanders)].slice(0, max)
  const seen = new Set<string>()
  const out: string[] = []
  for (const c of deck.cards) {
    if (isBasicOrUnlimited(c.cardName) || seen.has(c.cardName)) continue
    seen.add(c.cardName)
    out.push(c.cardName)
    if (out.length >= max) break
  }
  return out
}

export function deckCoverCard(deck: JoinDeck) {
  return deck.coverCard
    ?? deck.commanderCard
    ?? deck.commanders?.[0]
    ?? deck.cards.find((c) => !isBasicOrUnlimited(c.cardName))
    ?? deck.cards[0]
    ?? null
}

const LAST_DECK_KEY = 'xmage-join-deck-by-format'

function readLastDecks(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LAST_DECK_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? parsed as Record<string, string> : {}
  } catch {
    return {}
  }
}

export function lastDeckRefForFormat(profile: TableFormatProfile): string | null {
  return readLastDecks()[profile.key] ?? null
}

export function rememberDeckForFormat(profile: TableFormatProfile, deck: Deck): void {
  try {
    const map = readLastDecks()
    map[profile.key] = deckRef(deck)
    localStorage.setItem(LAST_DECK_KEY, JSON.stringify(map))
  } catch {}
}

export function pickInitialDeck<D extends JoinDeck>(
  ranked: Array<{ deck: D; fit: DeckFit }>,
  profile: TableFormatProfile,
  current: Deck | null,
): D | null {
  const last = lastDeckRefForFormat(profile)
  if (last) {
    const hit = ranked.find(({ deck }) => deckRef(deck) === last)
    if (hit) return hit.deck
  }
  if (current) {
    const hit = ranked.find(({ deck }) => (current.id && deck.id ? deck.id === current.id : deck.name === current.name))
    if (hit && isGoodFit(hit.fit)) return hit.deck
  }
  return ranked[0]?.deck ?? null
}
