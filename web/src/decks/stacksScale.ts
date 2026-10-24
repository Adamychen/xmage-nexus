export const DECK_STACKS_SCALE_MIN = 50
export const DECK_STACKS_SCALE_MAX = 200
export const DECK_STACKS_SCALE_STEP = 10
export const DECK_STACKS_SCALE_DEFAULT = 100

export function normalizeDeckStacksScale(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DECK_STACKS_SCALE_DEFAULT
  const stepped = Math.round(value / DECK_STACKS_SCALE_STEP) * DECK_STACKS_SCALE_STEP
  return Math.min(DECK_STACKS_SCALE_MAX, Math.max(DECK_STACKS_SCALE_MIN, stepped))
}
