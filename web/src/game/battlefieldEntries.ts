import type { GameView } from '../net/types'

let trackedGameId: string | null = null
let enteredOn = new Map<string, number>()

export function resetBattlefieldEntries(gameId: string | null = null): void {
  trackedGameId = gameId
  enteredOn = new Map()
}

function battlefieldIds(game: GameView): Set<string> {
  const ids = new Set<string>()
  for (const p of game.players ?? []) Object.keys(p.battlefield ?? {}).forEach((id) => ids.add(id))
  return ids
}

export function observeBattlefieldEntries(prev: GameView | null, next: GameView, gameId: string | null): Record<string, true> {
  if (gameId !== trackedGameId) resetBattlefieldEntries(gameId)
  const now = battlefieldIds(next)
  for (const id of [...enteredOn.keys()]) if (!now.has(id)) enteredOn.delete(id)
  if (prev) {
    const before = battlefieldIds(prev)
    for (const id of now) if (!before.has(id) && !enteredOn.has(id)) enteredOn.set(id, next.turn)
  }
  const result: Record<string, true> = {}
  for (const [id, turn] of enteredOn) if (turn === next.turn) result[id] = true
  return result
}

export function sameEntries(a: Record<string, true>, b: Record<string, true>): boolean {
  const ka = Object.keys(a)
  if (ka.length !== Object.keys(b).length) return false
  return ka.every((k) => b[k])
}
