import { cleanMageText } from '../game/gameEventParser'
import { getState } from '../state/state'

export const FIZZLE_MS = 650

const FIZZLE_TTL_MS = 5000
const fizzled = new Map<string, number>()

/** `Spell.java`: "<card name> has been fizzled." (no object id; abilities' "Ability has been fizzled: …" is ignored). */
export function parseFizzle(message: string): { name: string } | null {
  const m = cleanMageText(message).match(/^(.+?) has been fizzled\.?$/i)
  const name = m?.[1]?.trim()
  if (!name || name.toLowerCase() === 'ability') return null
  return { name }
}

/** The stack id of the first spell on `stack` (object key order) whose name matches, case-insensitively. */
export function fizzledSpellId(stack: Record<string, { name?: string }> | null | undefined, name: string): string | null {
  if (!stack) return null
  const wanted = name.trim().toLowerCase()
  for (const [id, card] of Object.entries(stack)) {
    if (card?.name?.trim().toLowerCase() === wanted) return id
  }
  return null
}

/** Marks a stack spell as reported fizzled by the game log. */
export function noteFizzled(id: string): void {
  fizzled.set(id, Date.now())
}

/** True once for a spell the log reported fizzled in the last few seconds. */
export function consumeFizzled(id: string): boolean {
  const at = fizzled.get(id)
  if (at === undefined) return false
  fizzled.delete(id)
  return Date.now() - at <= FIZZLE_TTL_MS
}

/** Forgets every pending fizzle mark. */
export function clearFizzled(): void {
  fizzled.clear()
}

/** Game-log hook: a fizzle line marks the matching spell of the current game's stack. */
export function sniffFizzle(message: string, gameId: string | null | undefined): void {
  if (!gameId) return
  const s = getState()
  if (s.gameId !== gameId) return
  const hit = parseFizzle(message)
  if (!hit) return
  const id = fizzledSpellId(s.game?.stack, hit.name)
  if (id) noteFizzled(id)
}
