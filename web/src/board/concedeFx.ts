import { cleanMageText } from '../game/gameEventParser'
import { getState } from '../state/state'

/** `GameImpl.concede`: "<player> has conceded." */
export function parseConcede(message: string): { player: string } | null {
  const m = cleanMageText(message).match(/^(.+?) has conceded\.?$/i)
  const player = m?.[1]?.trim()
  return player ? { player } : null
}

const CONCEDE_TTL_MS = 10000
const conceded = new Map<string, number>()

/** Remembers that the log reported this player conceding, timestamped now. */
export function noteConceded(playerId: string): void {
  conceded.set(playerId, Date.now())
}

/** True once for a player the log reported conceding in the last few seconds. */
export function consumeConceded(playerId: string): boolean {
  const at = conceded.get(playerId)
  if (at === undefined) return false
  conceded.delete(playerId)
  return Date.now() - at <= CONCEDE_TTL_MS
}

/** Forgets every remembered concession. */
export function clearConceded(): void {
  conceded.clear()
}

/** Game-log hook: a concession of a player of the current game is remembered for the elimination effect. */
export function sniffConcede(message: string, gameId: string | null | undefined): void {
  if (!gameId) return
  const s = getState()
  if (s.gameId !== gameId) return
  const concede = parseConcede(message)
  if (!concede) return
  const named = concede.player.toLowerCase()
  const player = s.game?.players?.find((p) => p.name.trim().toLowerCase() === named)
  if (player) noteConceded(player.playerId)
}
