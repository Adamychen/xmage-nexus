export const AURA_KEYWORDS = ['indestructible', 'hexproof', 'deathtouch', 'flying', 'lifelink', 'trample', 'haste'] as const

export type AuraKeyword = (typeof AURA_KEYWORDS)[number]

/** The highest-priority aura keyword among `ids` (order of AURA_KEYWORDS), or null. */
export function dominantAuraKeyword(ids: readonly string[]): AuraKeyword | null {
  const present = new Set(ids)
  return AURA_KEYWORDS.find((id) => present.has(id)) ?? null
}

/** Ids in `next` that were not in `prev` (blank ids ignored), in `next` order. */
export function gainedKeywordIds(prev: readonly string[], next: readonly string[]): string[] {
  const before = new Set(prev)
  return next.filter((id) => id !== '' && !before.has(id))
}

/** CSS keyframes name the `.kw-aura--<id>` span itself runs, e.g. 'flying' -> 'kwAuraFlying'. */
export function auraKeyframes(id: AuraKeyword): string {
  return 'kwAura' + id[0].toUpperCase() + id.slice(1)
}
