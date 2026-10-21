import { getState } from '../state/state'
import { fxMotionAllowed, fxMotionDuration } from './fx'
import { afterLayout, objectIdAfter, replayClass } from './gameLogFx'

const BEHOLD_MS = 800

/** `BeholdType`: "<player> chooses to behold <permanent>" — only the single-permanent form carries an object id. */
export function parseBehold(message: string): { objectId: string } | null {
  const at = message.search(/\bchooses to behold\b/i)
  if (at < 0) return null
  const objectId = objectIdAfter(message, at)
  return objectId ? { objectId } : null
}

/** The beheld card lifts and flashes where it is shown (battlefield or hand), never on the stack. */
export function beholdCard(cardId: string): void {
  if (!fxMotionAllowed() || typeof document === 'undefined') return
  afterLayout(() => {
    const slots = [...document.querySelectorAll(`.card-slot[data-card-id="${cardId}"]`)].filter((el) => !el.closest('.stack-zone, .stack-deck, .stack-list'))
    const ms = fxMotionDuration(BEHOLD_MS)
    for (const slot of slots) replayClass(slot, 'fx-behold', ms + 40)
  })
}

/** Game-log hook for behold lines of the current game. */
export function sniffBehold(message: string, gameId: string | null | undefined): void {
  if (!gameId) return
  const s = getState()
  if (s.gameId !== gameId) return
  const hit = parseBehold(message)
  if (hit) beholdCard(hit.objectId)
}
