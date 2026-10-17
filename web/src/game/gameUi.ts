export type GameUi = 'v1' | 'v2'

export const DEFAULT_GAME_UI: GameUi = 'v2'

export function normalizeGameUi(value: unknown): GameUi {
  return value === 'v1' || value === 'v2' ? value : DEFAULT_GAME_UI
}
