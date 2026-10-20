import type { GameView } from '../net/types'
import { seatColorVar, seatIndexOf } from './seatColor'

export interface ControlChange {
  id: string
  from: string
  to: string
}

/** A stolen (or returned) permanent's flight: the tether pulls it across in about this long. */
export const CONTROL_FLIGHT_MS = 900
const PRIMED_MS = 1500

/**
 * Permanents that changed controller in this update (Threaten, Control Magic, the effect ending):
 * the same id left one player's battlefield and is now on another's.
 */
export function controlChanges(prevGame: GameView | null | undefined, nextGame: GameView | null | undefined): ControlChange[] {
  if (!prevGame || !nextGame) return []
  const before = new Map<string, string>()
  for (const p of prevGame.players ?? []) for (const id of Object.keys(p.battlefield ?? {})) before.set(id, p.playerId)
  const out: ControlChange[] = []
  for (const p of nextGame.players ?? []) {
    for (const id of Object.keys(p.battlefield ?? {})) {
      const from = before.get(id)
      if (from !== undefined && from !== p.playerId) out.push({ id, from, to: p.playerId })
    }
  }
  return out
}

/** The seat colour of the player a permanent now belongs to: its tether and flight wear it. */
export function controlTintOf(game: GameView, change: ControlChange): string {
  return seatColorVar(seatIndexOf(game.players, change.to))
}

const primed = new Map<string, { tint: string; until: number }>()

/** Read while the update renders, so a slot mounting in its new controller's zone knows it was taken, not cast. */
export function primeControlChanges(prevGame: GameView | null | undefined, nextGame: GameView | null | undefined): void {
  if (!nextGame) return
  const until = Date.now() + PRIMED_MS
  for (const change of controlChanges(prevGame, nextGame)) primed.set(change.id, { tint: controlTintOf(nextGame, change), until })
}

/** The tint of a permanent that just changed controller, or null when it did not. */
export function controlChangeTint(id: string | null | undefined): string | null {
  if (!id) return null
  const entry = primed.get(id)
  if (!entry) return null
  if (entry.until < Date.now()) {
    primed.delete(id)
    return null
  }
  return entry.tint
}

export function clearControlChanges(): void {
  primed.clear()
}
