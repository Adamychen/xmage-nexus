import type { DeckCard } from '../lobby/decks'
import type { DeckV2 } from './types'
import type { ScryfallSearchCard } from './scryfallSearch'

export function cmcFromManaCost(manaCost?: string): number {
  if (!manaCost) return 0
  let cmc = 0
  const re = /\{([^}]+)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(manaCost))) {
    const sym = m[1]
    if (/^\d+$/.test(sym)) cmc += parseInt(sym, 10)
    else if (/^[WUBRG]$/.test(sym)) cmc += 1
    else if (/^[WUBRG]\/P$/.test(sym)) cmc += 1
    else if (/^2\/[WUBRG]$/.test(sym)) cmc += 2
    else if (/^[WUBRG]\/[WUBRG]$/.test(sym)) cmc += 1
    else if (sym === 'X') cmc += 0
    else cmc += 1
  }
  return cmc
}

export function colorsFromManaCost(manaCost?: string): ('W' | 'U' | 'B' | 'R' | 'G')[] {
  if (!manaCost) return []
  const set = new Set<'W' | 'U' | 'B' | 'R' | 'G'>()
  for (const c of ['W', 'U', 'B', 'R', 'G'] as const) {
    if (manaCost.includes(c)) set.add(c)
  }
  return [...set]
}

export function deckColorsFromSearch(cards: DeckCard[], cache: Map<string, ScryfallSearchCard>): ('W' | 'U' | 'B' | 'R' | 'G')[] {
  const set = new Set<'W' | 'U' | 'B' | 'R' | 'G'>()
  for (const c of cards) {
    const key = `${c.setCode}/${c.cardNumber}`
    const info = cache.get(key) ?? cache.get(c.cardName.toLowerCase())
    if (info) {
      for (const col of info.color_identity as ('W' | 'U' | 'B' | 'R' | 'G')[]) set.add(col)
    }
  }
  return [...set].sort()
}

export function buildCurve(cards: DeckCard[], meta: Map<string, ScryfallSearchCard>): number[] {
  const buckets = Array(8).fill(0) as number[]
  for (const c of cards) {
    const key = `${c.setCode}/${c.cardNumber}`
    const info = meta.get(key) ?? meta.get(c.cardName.toLowerCase())
    const cmc = info ? Math.min(info.cmc, 7) : 0
    const idx = cmc >= 7 ? 7 : cmc
    buckets[idx] += c.amount
  }
  return buckets
}

export function deckMainCount(d: DeckV2): number {
  return d.cards.reduce((s, c) => s + c.amount, 0)
}
export function deckSideCount(d: DeckV2): number {
  return d.sideboard.reduce((s, c) => s + c.amount, 0)
}

export function groupByCmc(cards: DeckCard[], meta: Map<string, ScryfallSearchCard>): Map<number, DeckCard[]> {
  const map = new Map<number, DeckCard[]>()
  for (let i = 0; i <= 7; i++) map.set(i, [])
  for (const c of cards) {
    const key = `${c.setCode}/${c.cardNumber}`
    const info = meta.get(key) ?? meta.get(c.cardName.toLowerCase())
    const cmc = info ? info.cmc : 0
    const bucket = cmc >= 7 ? 7 : cmc
    map.get(bucket)!.push(c)
  }
  return map
}

export function cardKey(c: DeckCard): string {
  return `${c.setCode}/${c.cardNumber}:${c.cardName}`
}
