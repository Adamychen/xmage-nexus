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

export interface BasicLandPreset {
  name: string
  color: 'W' | 'U' | 'B' | 'R' | 'G' | 'C'
  symbol: 'W' | 'U' | 'B' | 'R' | 'G' | 'C'
  label: string
  setCode: string
  cardNumber: string
}

export const BASIC_LAND_PRESETS: BasicLandPreset[] = [
  { name: 'Plains', color: 'W', symbol: 'W', label: 'Llanura', setCode: 'DMU', cardNumber: '277' },
  { name: 'Island', color: 'U', symbol: 'U', label: 'Isla', setCode: 'DMU', cardNumber: '278' },
  { name: 'Swamp', color: 'B', symbol: 'B', label: 'Pantano', setCode: 'DMU', cardNumber: '279' },
  { name: 'Mountain', color: 'R', symbol: 'R', label: 'Montaña', setCode: 'DMU', cardNumber: '280' },
  { name: 'Forest', color: 'G', symbol: 'G', label: 'Bosque', setCode: 'DMU', cardNumber: '281' },
  { name: 'Wastes', color: 'C', symbol: 'C', label: 'Yermos', setCode: 'OGW', cardNumber: '183' },
]

export function countManaPips(
  cards: DeckCard[],
  metaMap: Map<string, { manaCost?: string; typeLine?: string }>,
): Record<'W' | 'U' | 'B' | 'R' | 'G', number> {
  const pips: Record<'W' | 'U' | 'B' | 'R' | 'G', number> = { W: 0, U: 0, B: 0, R: 0, G: 0 }
  for (const c of cards) {
    const key = `${c.setCode}/${c.cardNumber}`
    const meta = metaMap.get(key) ?? metaMap.get(c.cardName.toLowerCase())
    if (meta?.typeLine?.toLowerCase().includes('land')) continue
    const manaCost = meta?.manaCost
    if (!manaCost) continue

    const re = /\{([^}]+)\}/g
    let m: RegExpExecArray | null
    while ((m = re.exec(manaCost))) {
      const sym = m[1]
      for (const color of ['W', 'U', 'B', 'R', 'G'] as const) {
        if (sym.includes(color)) {
          pips[color] += c.amount
        }
      }
    }
  }
  return pips
}

export function suggestBasicLands(
  pips: Record<'W' | 'U' | 'B' | 'R' | 'G', number>,
  targetLandCount = 24,
): { name: string; setCode: string; cardNumber: string; amount: number }[] {
  const activeColors = (['W', 'U', 'B', 'R', 'G'] as const).filter((col) => pips[col] > 0)
  if (activeColors.length === 0 || targetLandCount <= 0) {
    return []
  }

  const totalPips = activeColors.reduce((sum, col) => sum + pips[col], 0)
  if (totalPips === 0) return []

  const quota = activeColors.map((col) => {
    const exact = (pips[col] / totalPips) * targetLandCount
    const floored = Math.floor(exact)
    return {
      col,
      exact,
      floored,
      remainder: exact - floored,
    }
  })

  const assigned = quota.reduce((sum, q) => sum + q.floored, 0)
  const diff = targetLandCount - assigned

  quota.sort((a, b) => b.remainder - a.remainder)
  for (let i = 0; i < diff && i < quota.length; i++) {
    quota[i].floored += 1
  }

  return quota
    .filter((q) => q.floored > 0)
    .map((q) => {
      const preset = BASIC_LAND_PRESETS.find((p) => p.color === q.col)!
      return {
        name: preset.name,
        setCode: preset.setCode,
        cardNumber: preset.cardNumber,
        amount: q.floored,
      }
    })
}
