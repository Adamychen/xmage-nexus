export type PlaymatId = 'classic' | 'arcane' | 'verdant' | 'tides' | 'ember' | 'dawn' | 'abyss' | 'aurora' | 'identity' | 'custom'

export const CUSTOM_PLAYMAT_ID = 'custom'

export interface Playmat {
  id: PlaymatId
  animated: boolean
}

export const PLAYMATS: Playmat[] = [
  { id: 'classic', animated: false },
  { id: 'arcane', animated: false },
  { id: 'verdant', animated: false },
  { id: 'tides', animated: false },
  { id: 'ember', animated: false },
  { id: 'dawn', animated: false },
  { id: 'abyss', animated: false },
  { id: 'aurora', animated: true },
  { id: 'identity', animated: true },
]

/**
 * Cards staged on each picker tile so the mat reads as a table, not a colour
 * test (three art_crop images matched to the mat's colour story). Every name
 * must exist in `showcaseArt.generated.json` — guarded by playmats.test.ts.
 */
export const PLAYMAT_DEMO_CARDS: Record<PlaymatId, string[]> = {
  classic: ['Mountain', 'Lightning Bolt'],
  arcane: ['Counterspell', 'Sentinel Spider'],
  verdant: ['Forest', 'Birds of Paradise', 'Tarmogoyf'],
  tides: ['Island', 'Counterspell', 'Sentinel Spider'],
  ember: ['Mountain', 'Lightning Bolt', 'Shivan Dragon'],
  dawn: ['Plains', 'Sol Ring', 'Giant Growth'],
  abyss: ['Swamp', 'Sentinel Spider'],
  aurora: ['Birds of Paradise', 'Counterspell', 'Shivan Dragon'],
  identity: ['Tarmogoyf', 'Sentinel Spider', 'Lightning Bolt'],
  custom: [],
}

export const DEFAULT_PLAYMAT: PlaymatId = 'classic'

export function normalizePlaymat(id: unknown): PlaymatId {
  if (id === CUSTOM_PLAYMAT_ID) return CUSTOM_PLAYMAT_ID
  return PLAYMATS.some((m) => m.id === id) ? (id as PlaymatId) : DEFAULT_PLAYMAT
}

export function effectivePlaymat(id: PlaymatId | undefined, customImageUrl: string | null): PlaymatId {
  if (id === CUSTOM_PLAYMAT_ID) return customImageUrl ? CUSTOM_PLAYMAT_ID : DEFAULT_PLAYMAT
  return id ?? DEFAULT_PLAYMAT
}
