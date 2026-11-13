import type { CardView, PermanentView } from '../net/types'

/** BRD-44: a saga's chapters, read from the card the server sent. */

const VALUES: Record<string, number> = { I: 1, V: 5, X: 10 }

export function romanToInt(roman: string): number {
  let total = 0
  const s = roman.toUpperCase()
  for (let i = 0; i < s.length; i++) {
    const v = VALUES[s[i]]
    if (!v) return 0
    total += v < (VALUES[s[i + 1]] ?? 0) ? -v : v
  }
  return total
}

const ROMAN_PARTS: [value: number, roman: string][] = [
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
]

export function intToRoman(value: number): string {
  let left = Math.max(0, Math.floor(value))
  let out = ''
  for (const [v, roman] of ROMAN_PARTS) {
    while (left >= v) {
      out += roman
      left -= v
    }
  }
  return out
}

const CHAPTER_ROW = /^\s*((?:[IVX]+)(?:\s*,\s*[IVX]+)*)\s*(?:—|&mdash;|-)\s/
const SACRIFICE_AFTER = /sacrifice after\s+([IVX]+)/i

export function isSaga(card: Pick<CardView, 'subTypes'>): boolean {
  const subs: unknown = card.subTypes
  return Array.isArray(subs) && subs.some((t) => String(t).toUpperCase() === 'SAGA')
}

/**
 * How many chapters the saga has: the highest numeral of its chapter rows, or
 * of its reminder text ("Sacrifice after III"), and three when the rules say
 * nothing — every printed Saga has at least three.
 */
export function sagaChapters(card: Pick<CardView, 'rules'>): number {
  let last = 0
  for (const raw of card.rules ?? []) {
    const line = String(raw).replace(/<[^>]+>/g, ' ').trim()
    const row = CHAPTER_ROW.exec(line)
    if (row) {
      for (const part of row[1].split(',')) last = Math.max(last, romanToInt(part.trim()))
      continue
    }
    const after = SACRIFICE_AFTER.exec(line)
    if (after) last = Math.max(last, romanToInt(after[1]))
  }
  return last || 3
}

/** The chapter it is on: one lore counter per chapter read. */
export function sagaChapter(perm: Pick<PermanentView, 'counters'>): number {
  const lore = (perm.counters ?? []).find((c) => c.name.toLowerCase().includes('lore'))
  return lore?.count ?? 0
}
