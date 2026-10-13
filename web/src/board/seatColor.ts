import type { PlayerView } from '../net/types'
import { useStore } from '../state/store'
import { MAX_BOARD_PLAYERS } from './boardShared'

export const SEAT_COUNT = 4

export function seatIndexOf(players: PlayerView[] | undefined, playerId: string | undefined): number {
  if (!players || !playerId) return 0
  const seated = players.slice(0, MAX_BOARD_PLAYERS)
  const at = seated.findIndex((p) => p.playerId === playerId)
  if (at < 0) return 0
  if (seated[at].controlled) return 0
  const hasMe = seated.some((p) => p.controlled)
  const others = seated.filter((p) => !p.controlled)
  const rank = others.findIndex((p) => p.playerId === playerId)
  return (hasMe ? 1 + rank : rank) % SEAT_COUNT
}

export function seatColorVar(index: number): string {
  return `var(--seat-${index % SEAT_COUNT})`
}

export function useSeatColor(playerId: string | undefined): string {
  const players = useStore((s) => s.game?.players)
  return seatColorVar(seatIndexOf(players, playerId))
}
