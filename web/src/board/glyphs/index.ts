import { MTG_KEYWORDS } from '../../data/mtgKeywords'
import type { Glyph, GlyphGroup } from './types'
import { fallbacks, group as core } from './core'
import { group as combat } from './combat'
import { group as countersCards } from './counters-cards'
import { group as graveyard } from './graveyard'
import { group as mana } from './mana'
import { group as mech1 } from './mech-1'
import { group as mech2 } from './mech-2'
import { group as mech3 } from './mech-3'
import { group as mech4 } from './mech-4'
import { group as mech5 } from './mech-5'

export const SOLID_KEYWORDS = ['haste', 'deathtouch', 'flying', 'lifelink', 'trample', 'indestructible', 'hexproof'] as const

export type SolidKeyword = (typeof SOLID_KEYWORDS)[number]

export function isSolidKeyword(id: string): id is SolidKeyword {
  return (SOLID_KEYWORDS as readonly string[]).includes(id)
}

export const GLYPH_GROUPS: Readonly<Record<string, GlyphGroup>> = {
  core,
  combat,
  'counters-cards': countersCards,
  graveyard,
  mana,
  'mech-1': mech1,
  'mech-2': mech2,
  'mech-3': mech3,
  'mech-4': mech4,
  'mech-5': mech5,
}

const NODES: Record<string, Glyph> = {}
const ABBREVIATIONS: Record<string, string> = {}
for (const g of Object.values(GLYPH_GROUPS)) {
  Object.assign(NODES, g.glyphs)
  Object.assign(ABBREVIATIONS, g.abbreviations)
}

const ALIASES: Record<string, string> = {
  protection_from_everything: 'protection',
  squirrellink: 'lifelink',
  forestcycling: 'cycling',
  mountaincycling: 'cycling',
  partner_with: 'partner',
  doctors_companion: 'partner',
  station_level: 'station',
  toxic: 'infect',
  plainswalk: 'landwalk',
  islandwalk: 'landwalk',
  swampwalk: 'landwalk',
  mountainwalk: 'landwalk',
  forestwalk: 'landwalk',
}

const EVASION_FALLBACK_IDS = ['fear', 'intimidate', 'shadow', 'skulk', 'horsemanship']

export type KeywordGlyphSpec =
  | { kind: 'solid'; id: SolidKeyword }
  | { kind: 'nodes'; nodes: Glyph }
  | { kind: 'abbr'; text: string }
  | { kind: 'fallback'; nodes: Glyph }

function canonicalId(id: string): string {
  if (id.startsWith('hexproof_from_')) return 'hexproof'
  return ALIASES[id] ?? id
}

function categoryFallback(category: string): KeywordGlyphSpec {
  const key = category === 'evasion' ? 'evasion' : category === 'protection' ? 'protection' : 'combat'
  return { kind: 'fallback', nodes: fallbacks[key] }
}

export function resolveKeywordGlyph(id: string, category: string): KeywordGlyphSpec {
  if (EVASION_FALLBACK_IDS.includes(id)) return { kind: 'nodes', nodes: fallbacks.evasion }
  const key = canonicalId(id)
  if (isSolidKeyword(key)) return { kind: 'solid', id: key }
  if (NODES[key]) return { kind: 'nodes', nodes: NODES[key] }
  if (ABBREVIATIONS[key]) return { kind: 'abbr', text: ABBREVIATIONS[key] }
  return categoryFallback(category)
}

export function resolvableKeywordIds(): string[] {
  return MTG_KEYWORDS.filter((k) => resolveKeywordGlyph(k.id, k.category).kind !== 'fallback').map((k) => k.id)
}
