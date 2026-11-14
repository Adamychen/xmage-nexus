/**
 * BRD-47: the keywords whose symbol ships as a vector in `public/symbols/abilities`
 * (the Mana icon set: https://github.com/andrewgioia/mana, font under SIL OFL 1.1
 * and styles under MIT; the symbols themselves are Wizards of the Coast's, like
 * the mana symbols already served from `public/symbols`). The badge paints them
 * through a CSS mask, so their colour comes from the chip, and a keyword outside
 * this list keeps the glyph drawn in `glyphs/`.
 *
 * Generated from the folder: 59 symbols.
 */
export const ABILITY_ART = new Set<string>([
  'adapt',
  'afflict',
  'afterlife',
  'aftermath',
  'amass',
  'ascend',
  'backup',
  'blitz',
  'boast',
  'casualty',
  'changeling',
  'channel',
  'cleave',
  'companion',
  'constellation',
  'convoke',
  'deathtouch',
  'decayed',
  'defender',
  'disturb',
  'embalm',
  'enlist',
  'escape',
  'eternalize',
  'exploit',
  'explore',
  'fabricate',
  'flash',
  'flying',
  'foretell',
  'goad',
  'haste',
  'hexproof',
  'hideaway',
  'improvise',
  'incubate',
  'indestructible',
  'investigate',
  'kicker',
  'learn',
  'lifelink',
  'menace',
  'mentor',
  'mutate',
  'ninjutsu',
  'proliferate',
  'prototype',
  'prowess',
  'reach',
  'reconfigure',
  'riot',
  'spectacle',
  'surveil',
  'toxic',
  'training',
  'trample',
  'unearth',
  'vigilance',
  'ward',
])

export function abilityArtUrl(id: string): string | null {
  if (!ABILITY_ART.has(id)) return null
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'
  return `${base.endsWith('/') ? base : `${base}/`}symbols/abilities/${id}.svg`
}
