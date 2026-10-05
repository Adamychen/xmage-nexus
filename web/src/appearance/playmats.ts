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

export const DEFAULT_PLAYMAT: PlaymatId = 'classic'

export function normalizePlaymat(id: unknown): PlaymatId {
  if (id === CUSTOM_PLAYMAT_ID) return CUSTOM_PLAYMAT_ID
  return PLAYMATS.some((m) => m.id === id) ? (id as PlaymatId) : DEFAULT_PLAYMAT
}

export function effectivePlaymat(id: PlaymatId | undefined, customImageUrl: string | null): PlaymatId {
  if (id === CUSTOM_PLAYMAT_ID) return customImageUrl ? CUSTOM_PLAYMAT_ID : DEFAULT_PLAYMAT
  return id ?? DEFAULT_PLAYMAT
}
