import { cleanMageText } from '../game/gameEventParser'

/** Why a player is out of the game, read from the game log (the `GameView` only says `hasLeft`). */
export type OutReason = 'died' | 'conceded' | 'left'

const RANK: Record<OutReason, number> = { died: 0, conceded: 1, left: 2 }

const PATTERNS: Array<[RegExp, OutReason]> = [
  // `PlayerImpl.quit`, `timerTimeout` and `idleTimeout` log after their own "has lost the game".
  [/^(.+?) quits the match\b/i, 'left'],
  [/^(.+?) has run out of time\b/i, 'left'],
  [/^(.+?) was idle for too long\b/i, 'left'],
  // `GameImpl.concede` logs before the "has lost the game" its concession causes.
  [/^(.+?) has conceded\b/i, 'conceded'],
  [/^(.+?) has lost the game\b/i, 'died'],
]

export function parseOutReason(message: string): { player: string; reason: OutReason } | null {
  const text = cleanMageText(message)
  for (const [re, reason] of PATTERNS) {
    const player = text.match(re)?.[1]?.trim()
    if (player) return { player, reason }
  }
  return null
}

export function outReasonKey(gameId: string, player: string): string {
  return `${gameId}‖${player.trim().toLowerCase()}`
}

/** A concession or a quit is logged next to the "has lost the game" it causes: the more specific reason wins. */
export function mergeOutReason(current: OutReason | undefined, next: OutReason): OutReason {
  return current && RANK[current] >= RANK[next] ? current : next
}
