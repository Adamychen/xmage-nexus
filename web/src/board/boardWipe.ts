import type { GameView } from '../net/types'
import { combatantIds } from './combatStrikes'
import { getPreviousCardPosition } from './cardPositionRegistry'
import { fxMotionDuration } from './fx'
import { WIPE_MS, WIPE_WAVE_LEAD, WIPE_WAVE_SPAN } from './impactFx'

/** At least this many cards (not tokens) leaving the battlefield in one update read as a board wipe. */
export const BOARD_WIPE_MIN = 4
const PLAN_FRESH_MS = 1000

interface WipePlan {
  key: string
  at: number
  delays: Map<string, number>
}

let plan: WipePlan | null = null

/**
 * The permanents a board wipe takes in this update: every permanent, on any battlefield, that left
 * for a graveyard or exile (a token simply vanishes), when at least {@link BOARD_WIPE_MIN} of them
 * are cards. Combatants are left out, so combat damage killing a crowd is never a wipe.
 */
export function boardWipeIds(prevGame: GameView, nextGame: GameView): string[] {
  const combatants = new Set(combatantIds(prevGame))
  const onField = new Set<string>()
  const piles = new Set<string>()
  for (const p of nextGame.players ?? []) {
    for (const id of Object.keys(p.battlefield ?? {})) onField.add(id)
    for (const id of [...Object.keys(p.graveyard ?? {}), ...Object.keys(p.exile ?? {})]) piles.add(id)
  }
  const out: string[] = []
  let cards = 0
  for (const p of prevGame.players ?? []) {
    for (const [id, perm] of Object.entries(p.battlefield ?? {})) {
      if (onField.has(id) || combatants.has(id)) continue
      if ((perm as { isToken?: boolean }).isToken === true) {
        out.push(id)
      } else if (piles.has(id)) {
        out.push(id)
        cards++
      }
    }
  }
  return cards >= BOARD_WIPE_MIN ? out : []
}

function rectOf(el: Element | null | undefined): DOMRect | null {
  if (!el) return null
  const rect = el.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0 ? rect : null
}

/** The board the wave crosses: the board shell, or the viewport when there is none. */
export function wipeBoardRect(): DOMRect | null {
  if (typeof document === 'undefined') return null
  const shell = [...document.querySelectorAll('.board-shell')].map(rectOf).find((r): r is DOMRect => !!r)
  if (shell) return shell
  if (typeof window === 'undefined' || window.innerWidth <= 0) return null
  return new DOMRect(0, 0, window.innerWidth, window.innerHeight)
}

function slotRect(id: string): DOMRect | null {
  const slot = [...document.querySelectorAll(`.card-slot[data-card-id="${id}"]`)].find((el) => !el.closest('.stack-zone, .stack-deck, .stack-list'))
  return rectOf(slot) ?? getPreviousCardPosition(id)
}

/**
 * Plans a board wipe for this update and returns the permanents it takes: each one dies when the
 * wave crosses it, left to right. Read before the update paints (the slots are still drawn) or
 * after it (their last positions are registered); a second call for the same wipe keeps the plan.
 */
export function primeBoardWipe(prevGame: GameView | null | undefined, nextGame: GameView | null | undefined): string[] {
  if (!prevGame || !nextGame || typeof document === 'undefined') return []
  const ids = boardWipeIds(prevGame, nextGame)
  if (ids.length === 0) return ids
  const key = [...ids].sort().join('|')
  const now = Date.now()
  if (plan?.key === key && now - plan.at < PLAN_FRESH_MS) return ids
  const board = wipeBoardRect()
  const run = fxMotionDuration(WIPE_MS)
  const delays = new Map<string, number>()
  for (const id of ids) {
    const rect = slotRect(id)
    const across = rect && board ? (rect.left + rect.width / 2 - board.left) / board.width : 0.5
    delays.set(id, Math.round(run * (WIPE_WAVE_LEAD + Math.min(1, Math.max(0, across)) * WIPE_WAVE_SPAN)))
  }
  plan = { key, at: now, delays }
  return ids
}

/** How long a permanent taken by the current board wipe still waits for the wave. */
export function boardWipeDelay(id: string): number {
  const ms = plan?.delays.get(id)
  if (!plan || ms === undefined) return 0
  return Math.max(0, ms - (Date.now() - plan.at))
}

export function clearBoardWipe(): void {
  plan = null
}
