import type { CardView, GameView, PlayerView } from '../net/types'
import { cardManaColors, type ManaColor } from './impactFx'
import { landTapColor } from './compactCard'

/** A permanent that became a creature rises into the creature band in about this long. */
export const ANIMATE_FLIGHT_MS = 720
/** One that stopped being a creature settles back, softer and quicker. */
export const SETTLE_FLIGHT_MS = 520
const PRIMED_MS = 1500

export interface CreatureShift {
  id: string
  playerId: string
  /** True when it became a creature (an animated land, a crewed vehicle), false when it stopped being one. */
  rises: boolean
}

function isCreature(card: CardView | undefined): boolean {
  return (card?.cardTypes ?? []).some((t) => String(t).toUpperCase() === 'CREATURE')
}

/**
 * Permanents of `nextP` that stayed on the battlefield and started or stopped being a creature
 * (Mutavault, a crewed vehicle, Gideon, the effect wearing off at end of turn). A permanent that
 * changed face (transform, turned face up) is left to the animation of that change.
 */
export function creatureShifts(prevP: PlayerView, nextP: PlayerView): CreatureShift[] {
  const before = prevP.battlefield ?? {}
  const out: CreatureShift[] = []
  for (const [id, next] of Object.entries(nextP.battlefield ?? {})) {
    const prev = before[id]
    if (!prev || prev.phasedIn === false || next.phasedIn === false) continue
    if ((prev.transformed === true) !== (next.transformed === true) || (prev.faceDown === true) !== (next.faceDown === true)) continue
    const was = isCreature(prev)
    const now = isCreature(next)
    if (was !== now) out.push({ id, playerId: nextP.playerId, rises: now })
  }
  return out
}

function allShifts(prevGame: GameView, nextGame: GameView): CreatureShift[] {
  return (nextGame.players ?? []).flatMap((nextP) => {
    const prevP = (prevGame.players ?? []).find((p) => p.playerId === nextP.playerId)
    return prevP ? creatureShifts(prevP, nextP) : []
  })
}

const MANA: ManaColor[] = ['w', 'u', 'b', 'r', 'g']

/** The colour a permanent that becomes a creature glows in: the mana a land makes, else its own colour. */
export function animateColor(card: CardView): ManaColor | null {
  const land = landTapColor(card)?.toLowerCase() as ManaColor | undefined
  if (land && MANA.includes(land)) return land
  return cardManaColors(card)[0] ?? null
}

/** The flight tint of a permanent rising into the creature band, or null for the default gold. */
export function animateTint(card: CardView): string | null {
  const color = animateColor(card)
  return color ? `rgb(var(--mana-${color}-rgb))` : null
}

const primed = new Map<string, { rises: boolean; until: number }>()

/** Read while the update renders, so a slot remounting in the other band knows it changed type and flies there instead of jumping. */
export function primeCreatureShifts(prevGame: GameView | null | undefined, nextGame: GameView | null | undefined): void {
  if (!prevGame || !nextGame) return
  const until = Date.now() + PRIMED_MS
  for (const shift of allShifts(prevGame, nextGame)) primed.set(shift.id, { rises: shift.rises, until })
}

/** Whether a permanent just became a creature ('rise') or stopped being one ('settle'), or null. */
export function creatureShiftOf(id: string | null | undefined): 'rise' | 'settle' | null {
  if (!id) return null
  const entry = primed.get(id)
  if (!entry) return null
  if (entry.until < Date.now()) {
    primed.delete(id)
    return null
  }
  return entry.rises ? 'rise' : 'settle'
}

export function clearCreatureShifts(): void {
  primed.clear()
}
