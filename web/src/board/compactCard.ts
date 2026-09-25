import type { CardView } from '../net/types'

export type CardStyle = 'classic' | 'compact'

export const CARD_STYLES: readonly CardStyle[] = ['classic', 'compact']

/** Height / width of a classic (printed) card. */
export const CLASSIC_CARD_ASPECT = 1.4
/** Height / width of a compact battlefield tile (Scryfall `art_crop` is ~626×457). */
export const COMPACT_CARD_ASPECT = 0.75

export type TapStyle = 'sideways' | 'tilted'

export const TAP_STYLES: readonly TapStyle[] = ['sideways', 'tilted']

export function normalizeTapStyle(value: unknown): TapStyle {
  return value === 'tilted' ? 'tilted' : 'sideways'
}

export function normalizeCardStyle(value: unknown): CardStyle {
  return value === 'compact' ? 'compact' : 'classic'
}

export function cardAspectFor(style: CardStyle): number {
  return style === 'compact' ? COMPACT_CARD_ASPECT : CLASSIC_CARD_ASPECT
}

const SCRYFALL_IMAGE = /^(https:\/\/cards\.scryfall\.io\/)(?:small|normal|large)\/(.+)$/

/** Scryfall CDN art-crop URL for a card image URL, or null when it is not a Scryfall CDN image. */
export function artCropUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null
  const m = SCRYFALL_IMAGE.exec(imageUrl)
  if (!m) return null
  return `${m[1]}art_crop/${m[2]}`
}

const COLORED = ['W', 'U', 'B', 'R', 'G', 'C'] as const
const ADD_CLAUSE = /\badd\b([^.]*)/gi
const ANY_COLOR = /\bany (?:color|colour|type)\b|\bany combination of colors\b/i
const BASIC_TYPES: Record<string, string> = { PLAINS: 'W', ISLAND: 'U', SWAMP: 'B', MOUNTAIN: 'R', FOREST: 'G' }

/**
 * Mana a permanent can produce, read from its rules text (`{T}: Add {G}.`) and
 * its basic land types. `ANY` stands for "one mana of any color". Empty when
 * the permanent is not a mana source.
 */
export function manaSourceSymbols(card: CardView): string[] {
  const found = new Set<string>()
  let any = false
  for (const rule of card.rules ?? []) {
    const text = String(rule)
    for (const match of text.matchAll(ADD_CLAUSE)) {
      const clause = match[1]
      if (ANY_COLOR.test(clause)) any = true
      for (const sym of clause.matchAll(/\{([^}]+)\}/g)) {
        const s = sym[1].toUpperCase()
        if ((COLORED as readonly string[]).includes(s)) found.add(s)
      }
    }
  }
  for (const sub of Array.isArray(card.subTypes) ? card.subTypes : []) {
    const color = BASIC_TYPES[String(sub).toUpperCase()]
    if (color) found.add(color)
  }
  if (any) return ['ANY']
  return COLORED.filter((c) => found.has(c))
}

const TYPE_PRIORITY = ['creature', 'planeswalker', 'battle', 'land', 'artifact', 'enchantment', 'instant', 'sorcery'] as const
export type TileType = typeof TYPE_PRIORITY[number]

/** The card type that names a battlefield tile (creature wins over artifact, etc.). */
export function primaryCardType(card: CardView): TileType | null {
  const types = (card.cardTypes ?? []).map((t) => String(t).toLowerCase())
  return TYPE_PRIORITY.find((t) => types.includes(t)) ?? null
}
