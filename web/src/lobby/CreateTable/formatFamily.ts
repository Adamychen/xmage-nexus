import type { GameTypeInfo } from '../../net/commands'
import type { IconName } from '../../ui/Icon'

export type DeckFamily = 'constructed' | 'block' | 'variant' | 'limited'
export type GameFamily = 'classic' | 'variant'
export type Tone = 'gold' | 'brand' | 'violet' | 'ok' | 'warn'

/** Which description a format gets in the gallery (see the `format_desc_*` strings). */
export type DescGroup =
  | 'duel' | 'multi' | 'commander' | 'oathbreaker' | 'brawl' | 'tiny' | 'highlander'
  | 'momir' | 'penny' | 'freeform' | 'pauper' | 'limited' | 'block' | 'constructed'

/** What a format looks like in the gallery: its icon, its colour, an optional card whose art sets the mood, and what it is about. */
export interface FormatVisual {
  icon: IconName
  tone: Tone
  art: string | null
  group: DescGroup
}

const DEFAULT_VISUAL: FormatVisual = { icon: 'swords', tone: 'brand', art: null, group: 'duel' }

/** First match wins, so the specific variants come before the broad Commander rule. */
const VISUAL_RULES: Array<{ test: RegExp; visual: FormatVisual }> = [
  { test: /Oathbreaker/i, visual: { icon: 'wand', tone: 'violet', art: 'Chandra, Torch of Defiance', group: 'oathbreaker' } },
  { test: /Brawl/i, visual: { icon: 'shield', tone: 'gold', art: "Elspeth, Sun's Champion", group: 'brawl' } },
  { test: /Tiny Leaders/i, visual: { icon: 'gem', tone: 'gold', art: 'Sol Ring', group: 'tiny' } },
  { test: /Canadian Highlander/i, visual: { icon: 'mountain', tone: 'brand', art: 'Black Lotus', group: 'highlander' } },
  { test: /Momir/i, visual: { icon: 'dice', tone: 'violet', art: 'Momir Vig, Simic Visionary', group: 'momir' } },
  { test: /Penny Dreadful/i, visual: { icon: 'scale', tone: 'violet', art: null, group: 'penny' } },
  { test: /Commander/i, visual: { icon: 'crown', tone: 'gold', art: 'Command Tower', group: 'commander' } },
  { test: /Freeform/i, visual: { icon: 'wind', tone: 'violet', art: null, group: 'freeform' } },
  { test: /Pauper/i, visual: { icon: 'circle', tone: 'warn', art: null, group: 'pauper' } },
  { test: /^Limited$/, visual: { icon: 'layers', tone: 'warn', art: null, group: 'limited' } },
  { test: /^Block Constructed/, visual: { icon: 'book', tone: 'ok', art: null, group: 'block' } },
  { test: /^Constructed/, visual: { icon: 'shield', tone: 'brand', art: null, group: 'constructed' } },
  { test: /^Free For All$/, visual: { icon: 'users', tone: 'ok', art: null, group: 'multi' } },
]

export function visualOf(name: string): FormatVisual {
  return VISUAL_RULES.find((rule) => rule.test.test(name))?.visual ?? DEFAULT_VISUAL
}

/** The family a deck format belongs to, from the prefix XMage gives its name. */
export function deckTypeFamily(deckType: string): DeckFamily {
  if (deckType.startsWith('Limited')) return 'limited'
  if (deckType.startsWith('Block Constructed')) return 'block'
  if (deckType.startsWith('Variant Magic')) return 'variant'
  return 'constructed'
}

export const DUEL_SUFFIX = ' Two Player Duel'
export const MULTI_SUFFIX = ' Free For All'

export type GameMode = 'duel' | 'multi' | 'any'

export interface GameTypeMode {
  value: string
  mode: GameMode
  meta: string
}

/** One format base (Commander, Brawl, ...) with the game types it offers, so 1v1 and multiplayer share one card. */
export interface GameTypeBase {
  id: string
  /** The format base as XMage names it; empty for the classic base, which the UI labels. */
  label: string
  family: GameFamily
  visual: FormatVisual
  modes: GameTypeMode[]
}

/**
 * Groups the flat game-type list by format base: "Commander Two Player Duel" and "Commander Free For All"
 * become one "Commander" base with a duel mode and a multiplayer mode. Plain "Two Player Duel" and
 * "Free For All" form the classic base. Types without either suffix stay as a base of their own.
 */
export function groupGameTypes(items: GameTypeInfo[]): GameTypeBase[] {
  const bases = new Map<string, GameTypeBase>()
  for (const info of items) {
    let base: string
    let mode: GameMode
    if (info.name.endsWith(DUEL_SUFFIX)) {
      base = info.name.slice(0, -DUEL_SUFFIX.length)
      mode = 'duel'
    } else if (info.name.endsWith(MULTI_SUFFIX)) {
      base = info.name.slice(0, -MULTI_SUFFIX.length)
      mode = 'multi'
    } else if (info.name === 'Two Player Duel') {
      base = ''
      mode = 'duel'
    } else if (info.name === 'Free For All') {
      base = ''
      mode = 'multi'
    } else {
      base = info.name
      mode = 'any'
    }
    const id = base || 'classic'
    const existing = bases.get(id) ?? {
      id,
      label: base,
      family: base ? 'variant' : 'classic',
      visual: visualOf(base || 'Two Player Duel'),
      modes: [],
    }
    existing.modes.push({ value: info.name, mode, meta: `${info.minPlayers}–${info.maxPlayers}` })
    bases.set(id, existing)
  }
  return [...bases.values()]
}
