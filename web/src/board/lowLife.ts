import type { PlayerView } from '../net/types'

export type LowLifeLevel = 0 | 1 | 2

export const LOW_LIFE = 5
export const CRITICAL_LIFE = 2

export function poisonOf(player: Pick<PlayerView, 'counters'>): number {
  const counters = Array.isArray(player.counters) ? player.counters : []
  return counters
    .filter((c) => String(c?.name ?? '').toLowerCase() === 'poison')
    .reduce((sum, c) => sum + (typeof c.count === 'number' ? c.count : 0), 0)
}

export function lowLifeLevel(player: Pick<PlayerView, 'life' | 'counters'> | null | undefined): LowLifeLevel {
  if (!player || typeof player.life !== 'number') return 0
  const poison = poisonOf(player)
  if (player.life <= CRITICAL_LIFE || poison >= 9) return 2
  if (player.life <= LOW_LIFE || poison >= 7) return 1
  return 0
}

export function heartbeatCount(level: LowLifeLevel): number {
  return level === 2 ? 6 : level === 1 ? 3 : 0
}

export function heartbeatIntervalMs(level: LowLifeLevel): number {
  return level === 2 ? 640 : 900
}
