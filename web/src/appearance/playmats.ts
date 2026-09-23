export type PlaymatId = 'classic' | 'arcane' | 'verdant' | 'tides' | 'ember' | 'dawn' | 'abyss' | 'aurora' | 'identity'

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
  return PLAYMATS.some((m) => m.id === id) ? (id as PlaymatId) : DEFAULT_PLAYMAT
}
