import type { CardView, GameView, DeckJson } from '../net/types'
import type { Deck } from '../lobby/decks'
import { normalizeBasicLandName } from '../decks/deckUtils'
import { computeDeckTracker, type DeckTrackerStats } from './deckTracker'

export type ManaColorCode = 'W' | 'U' | 'B' | 'R' | 'G' | 'C'

export interface MulliganEvaluation {
  cardCount: number
  landCount: number
  spellCount: number
  colorCodes: ManaColorCode[]
  thirdLandMissing: number
  thirdLandProbability: number | null
  drawsConsidered: number
}

const BASIC_LAND_COLOR: Record<string, ManaColorCode> = {
  Plains: 'W',
  Island: 'U',
  Swamp: 'B',
  Mountain: 'R',
  Forest: 'G',
  Wastes: 'C',
}

const COLOR_ORDER: ManaColorCode[] = ['W', 'U', 'B', 'R', 'G', 'C']

export const MULLIGAN_TARGET_LANDS = 3
export const MULLIGAN_DRAWS_BY_T3 = 2

function isLandCard(card: CardView): boolean {
  if (normalizeBasicLandName(card.name || card.displayName || '')) return true
  return (card.cardTypes ?? []).some((t) => t.toLowerCase() === 'land')
}

function colorsProducedBy(card: CardView): Set<ManaColorCode> {
  const colors = new Set<ManaColorCode>()
  for (const line of card.rules ?? []) {
    if (!/\badd\b/i.test(line)) continue
    for (const sym of line.match(/\{([WUBRGC])\}/g) ?? []) {
      colors.add(sym.slice(1, -1) as ManaColorCode)
    }
  }
  if (colors.size === 0) {
    const canonical = normalizeBasicLandName(card.name || card.displayName || '')
    if (canonical && BASIC_LAND_COLOR[canonical]) colors.add(BASIC_LAND_COLOR[canonical])
  }
  return colors
}

function comb(n: number, r: number): number {
  if (r < 0 || r > n || n < 0) return 0
  const rr = Math.min(r, n - r)
  let result = 1
  for (let i = 0; i < rr; i++) {
    result = (result * (n - i)) / (i + 1)
  }
  return result
}

/** P(X >= minSuccesses) drawing `draws` cards from a population without replacement. */
export function hypergeometricAtLeast(
  populationSize: number,
  successStates: number,
  draws: number,
  minSuccesses: number,
): number {
  if (minSuccesses <= 0) return 1
  if (populationSize <= 0 || draws <= 0 || successStates <= 0) return 0
  const n = Math.min(draws, populationSize)
  const total = comb(populationSize, n)
  if (total <= 0) return 0
  const maxK = Math.min(n, successStates)
  let cumulative = 0
  for (let k = minSuccesses; k <= maxK; k++) {
    cumulative += comb(successStates, k) * comb(populationSize - successStates, n - k)
  }
  return Math.min(1, Math.max(0, cumulative / total))
}

export function evaluateMulliganHand(
  hand: CardView[],
  deckTrackerStats: DeckTrackerStats | null,
): MulliganEvaluation {
  const cards = hand.filter(Boolean)
  const cardCount = cards.length
  const colors = new Set<ManaColorCode>()
  let landCount = 0
  for (const card of cards) {
    if (!isLandCard(card)) continue
    landCount++
    for (const c of colorsProducedBy(card)) colors.add(c)
  }
  const spellCount = cardCount - landCount
  const thirdLandMissing = Math.max(0, MULLIGAN_TARGET_LANDS - landCount)

  let thirdLandProbability: number | null = null
  if (thirdLandMissing > 0 && deckTrackerStats && deckTrackerStats.remainingTotal > 0) {
    thirdLandProbability = Math.round(
      hypergeometricAtLeast(
        deckTrackerStats.remainingTotal,
        deckTrackerStats.countsRemaining.land,
        MULLIGAN_DRAWS_BY_T3,
        thirdLandMissing,
      ) * 100,
    )
  }

  return {
    cardCount,
    landCount,
    spellCount,
    colorCodes: COLOR_ORDER.filter((c) => colors.has(c)),
    thirdLandMissing,
    thirdLandProbability,
    drawsConsidered: MULLIGAN_DRAWS_BY_T3,
  }
}

export function computeMulliganEvaluation(
  hand: CardView[],
  deck: Deck | DeckJson | null,
  game: GameView | null,
  myPlayerId?: string | null,
): MulliganEvaluation {
  const hasDeck = !!(deck && deck.cards && deck.cards.length > 0)
  const trackerStats = hasDeck ? computeDeckTracker(deck, game, myPlayerId) : null
  return evaluateMulliganHand(hand, trackerStats)
}
