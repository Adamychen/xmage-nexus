import type { DeckCard } from '../lobby/decks'
import type { CardStripMeta } from './ArenaCardStrip'
import { CARD_CATEGORY_ORDER, categorizeCard, type CardCategory } from './cardCategory'
import { deckCardKey } from './deckCardOps'

export interface DeckPile {
  id: string
  label: string
}

export type PileCopies = Record<string, number>

export interface DeckStackPiles {
  piles: DeckPile[]
  assign: Record<string, PileCopies>
}

export interface StoredStackPiles {
  piles: DeckPile[]
  assign: Record<string, string | PileCopies>
}

export const UNSORTED = 'unsorted'

export interface CopySplit {
  piles: PileCopies
  unsorted: number
}

function amountsByKey(cards: readonly DeckCard[]): Map<string, number> {
  const amounts = new Map<string, number>()
  for (const card of cards) {
    const key = deckCardKey(card)
    amounts.set(key, (amounts.get(key) ?? 0) + card.amount)
  }
  return amounts
}

function sumOf(counts: PileCopies): number {
  return Object.values(counts).reduce((sum, n) => sum + n, 0)
}

function positiveCounts(counts: PileCopies): PileCopies {
  return Object.fromEntries(Object.entries(counts).filter(([, n]) => Number.isInteger(n) && n > 0))
}

export function normalizeStackPiles(stored: StoredStackPiles | undefined, cards: readonly DeckCard[]): DeckStackPiles | undefined {
  if (!stored) return undefined
  const amounts = amountsByKey(cards)
  const assign: Record<string, PileCopies> = {}
  for (const [key, value] of Object.entries(stored.assign)) {
    const counts = typeof value === 'string'
      ? (amounts.has(key) ? { [value]: amounts.get(key)! } : {})
      : positiveCounts(value)
    if (Object.keys(counts).length > 0) assign[key] = counts
  }
  return { piles: stored.piles, assign }
}

function trimToAmount(held: PileCopies, order: readonly string[], amount: number): void {
  let surplus = sumOf(held) - amount
  const present = order.filter((id) => held[id] > 0)
  const fewest = [...present].sort((a, b) => held[a] - held[b] || present.indexOf(a) - present.indexOf(b))
  for (const id of fewest) {
    if (surplus <= 0) break
    const cut = Math.min(surplus, held[id])
    surplus -= cut
    const left = held[id] - cut
    if (left > 0) held[id] = left
    else delete held[id]
  }
}

function largestOf(counts: PileCopies, pileOrder: readonly string[]): string | undefined {
  let best: string | undefined
  for (const id of pileOrder) {
    if (counts[id] > 0 && (best === undefined || counts[id] > counts[best])) best = id
  }
  return best
}

export function reconcileCopies(counts: PileCopies, amount: number, pileOrder: readonly string[]): CopySplit {
  const order = [...pileOrder, UNSORTED]
  const held: PileCopies = {}
  for (const id of order) {
    if (counts[id] > 0) held[id] = counts[id]
  }
  trimToAmount(held, order, amount)
  const missing = amount - sumOf(held)
  if (missing > 0) {
    const place = largestOf(held, pileOrder) ?? UNSORTED
    held[place] = (held[place] ?? 0) + missing
  }
  const { [UNSORTED]: unsorted = 0, ...piles } = held
  return { piles, unsorted }
}

export function largestPile(sp: DeckStackPiles, cardKey: string): string | undefined {
  return largestOf(sp.assign[cardKey] ?? {}, sp.piles.map((p) => p.id))
}

export function pilesHolding(sp: DeckStackPiles, cardKey: string, amount: number): string[] {
  return Object.keys(reconcileCopies(sp.assign[cardKey] ?? {}, amount, sp.piles.map((p) => p.id)).piles)
}

export function reconcileStackPiles(sp: DeckStackPiles, cards: readonly DeckCard[]): DeckStackPiles {
  const order = sp.piles.map((p) => p.id)
  const assign: Record<string, PileCopies> = {}
  for (const [key, amount] of amountsByKey(cards)) {
    const { piles, unsorted } = reconcileCopies(sp.assign[key] ?? {}, amount, order)
    const counts = unsorted > 0 ? { ...piles, [UNSORTED]: unsorted } : piles
    if (Object.keys(counts).length > 0) assign[key] = counts
  }
  return { piles: sp.piles, assign }
}

export function seedStackPiles(
  cards: DeckCard[],
  metaOf: (card: DeckCard) => CardStripMeta | undefined,
  typeLabels: Record<CardCategory, string>,
): DeckStackPiles {
  const categoryOf = new Map<string, CardCategory>()
  for (const card of cards) {
    categoryOf.set(deckCardKey(card), categorizeCard(metaOf(card)?.typeLine))
  }
  const usedCategories = new Set(categoryOf.values())
  const piles: DeckPile[] = []
  const pileOf = new Map<CardCategory, string>()
  for (const category of CARD_CATEGORY_ORDER) {
    if (!usedCategories.has(category)) continue
    const id = `p${piles.length + 1}`
    piles.push({ id, label: typeLabels[category] })
    pileOf.set(category, id)
  }
  const amounts = amountsByKey(cards)
  const assign: Record<string, PileCopies> = {}
  for (const [key, category] of categoryOf) {
    const amount = amounts.get(key) ?? 0
    if (amount > 0) assign[key] = { [pileOf.get(category)!]: amount }
  }
  return { piles, assign }
}

export function addPile(sp: DeckStackPiles, label: string): { next: DeckStackPiles; id: string } {
  const used = new Set([...sp.piles.map((p) => p.id), ...Object.values(sp.assign).flatMap((counts) => Object.keys(counts))])
  let n = 1
  while (used.has(`p${n}`)) n++
  const id = `p${n}`
  return { next: { ...sp, piles: [...sp.piles, { id, label }] }, id }
}

export function renamePile(sp: DeckStackPiles, id: string, label: string): DeckStackPiles {
  const name = label.trim()
  if (!name || !sp.piles.some((p) => p.id === id)) return sp
  return { ...sp, piles: sp.piles.map((p) => (p.id === id ? { ...p, label: name } : p)) }
}

export function removePile(sp: DeckStackPiles, id: string): DeckStackPiles {
  if (!sp.piles.some((p) => p.id === id)) return sp
  if (Object.values(sp.assign).some((counts) => (counts[id] ?? 0) > 0)) return sp
  return { ...sp, piles: sp.piles.filter((p) => p.id !== id) }
}

function placeOf(sp: DeckStackPiles, id: string): string {
  return id === UNSORTED || sp.piles.some((p) => p.id === id) ? id : UNSORTED
}

function withCounts(sp: DeckStackPiles, cardKey: string, counts: PileCopies): DeckStackPiles {
  const assign = { ...sp.assign }
  if (Object.keys(counts).length > 0) assign[cardKey] = counts
  else delete assign[cardKey]
  return { ...sp, assign }
}

export function addCopies(sp: DeckStackPiles, cardKey: string, to: string, n: number): DeckStackPiles {
  const counts: PileCopies = { ...(sp.assign[cardKey] ?? {}) }
  const place = placeOf(sp, to)
  counts[place] = (counts[place] ?? 0) + n
  return withCounts(sp, cardKey, counts)
}

export function takeCopies(sp: DeckStackPiles, cardKey: string, from: string, n: number): DeckStackPiles {
  const counts: PileCopies = { ...(sp.assign[cardKey] ?? {}) }
  const taken = Math.min(n, counts[from] ?? 0)
  if (taken <= 0) return sp
  const left = counts[from] - taken
  if (left > 0) counts[from] = left
  else delete counts[from]
  return withCounts(sp, cardKey, counts)
}

export function moveCopies(sp: DeckStackPiles, cardKey: string, from: string, to: string, n: number): DeckStackPiles {
  const dest = placeOf(sp, to)
  if (from === dest) return sp
  const taken = Math.min(n, sp.assign[cardKey]?.[from] ?? 0)
  if (taken <= 0) return sp
  return addCopies(takeCopies(sp, cardKey, from, taken), cardKey, dest, taken)
}

export function assignAllCopies(sp: DeckStackPiles, cardKey: string, pileId: string, amount: number): DeckStackPiles {
  return withCounts(sp, cardKey, amount > 0 ? { [placeOf(sp, pileId)]: amount } : {})
}

export function pruneStackPiles(sp: DeckStackPiles, cards: DeckCard[]): DeckStackPiles {
  const keys = new Set(cards.map((c) => deckCardKey(c)))
  const assign = Object.fromEntries(Object.entries(sp.assign).filter(([key]) => keys.has(key)))
  return { ...sp, assign }
}
