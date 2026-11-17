/**
 * BRD-53: the counters a player or a card can hold, and the symbol each one is drawn with. The files live in
 * `public/symbols/counters` and are painted through a mask, so the symbol takes the colour of the
 * badge it sits in, like the keyword badges (BRD-47).
 *
 * Sources: every counter of a card, and poison, energy, the ticket and the acorn, come from the Mana icon set
 * (https://github.com/andrewgioia/mana, font under SIL OFL 1.1 and styles under MIT), experience
 * and radiation from mtg.wiki (`Exp.svg`, `Rad.svg`); the symbols themselves are Wizards of the
 * Coast's, like the mana symbols this app already serves from `public/symbols`.
 */
const COUNTER_ART = new Set([
  // On a player.
  'poison', 'energy', 'experience', 'rad', 'ticket', 'acorn',
  // On a card.
  'arrow', 'brick', 'charge', 'devotion', 'doom', 'echo', 'flame', 'flood', 'fungus', 'gold', 'ki',
  'mining', 'muster', 'pin', 'scream', 'shield', 'slime', 'stun', 'time', 'verse', 'vortex',
])

/** The counter a name stands for, whatever case the server sends it in. */
export function counterArtId(name: string): string | undefined {
  const n = String(name ?? '').trim().toLowerCase()
  if (!n) return undefined
  if (COUNTER_ART.has(n)) return n
  // The engine calls radiation counters "rad"; a card may spell it out.
  if (n === 'radiation') return 'rad'
  return undefined
}

export function counterArtUrl(name: string): string | null {
  const id = counterArtId(name)
  if (!id) return null
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'
  return `${base.endsWith('/') ? base : `${base}/`}symbols/counters/${id}.svg`
}
