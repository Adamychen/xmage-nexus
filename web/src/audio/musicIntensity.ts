import type { GameView } from '../net/types'
import { stringList } from '../state/gameUtils'

export type MusicIntensity = 0 | 1 | 2

export const TENSE_LIFE = 10
export const CRITICAL_MUSIC_LIFE = 5

export function musicIntensity(game: GameView | null | undefined): MusicIntensity {
  if (!game) return 0
  const alive = (game.players ?? []).filter((p) => !p.hasLeft && typeof p.life === 'number')
  if (alive.length === 0) return 0
  const minLife = Math.min(...alive.map((p) => p.life))
  let level: number = minLife <= CRITICAL_MUSIC_LIFE ? 2 : minLife <= TENSE_LIFE ? 1 : 0
  const attacking = (game.combat ?? []).some((g) => stringList((g as { attackers?: unknown }).attackers).length > 0)
  if (attacking) level = Math.max(level, 1)
  if (Object.keys(game.stack ?? {}).length >= 3) level += 1
  return Math.min(2, level) as MusicIntensity
}
