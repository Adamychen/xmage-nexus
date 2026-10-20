import type { GameView, PlayerView } from '../net/types'
import { flyManaOrb, manaPoolElement } from './manaParticle'

export const MANA_SPENT_STAGGER_MS = 70
const MAX_ORBS = 8

const POOL_SYMBOLS: Array<[keyof PlayerView['manaPool'], string]> = [
  ['white', 'W'],
  ['blue', 'U'],
  ['black', 'B'],
  ['red', 'R'],
  ['green', 'G'],
  ['colorless', 'C'],
]

export interface ManaSpend {
  playerId: string
  /** One mana symbol per orb, in WUBRGC order. */
  colors: string[]
  spellId: string
}

/**
 * Pools that lost mana in the view that put a new spell or ability on the stack: the mana paid for it.
 * A pool that empties with nothing new on the stack (the end of a step) spends nothing.
 */
export function manaSpends(prevGame: GameView | null | undefined, nextGame: GameView | null | undefined): ManaSpend[] {
  if (!prevGame || !nextGame) return []
  const prevStack = prevGame.stack ?? {}
  const added = Object.entries(nextGame.stack ?? {}).filter(([id]) => !(id in prevStack))
  if (added.length === 0) return []
  const out: ManaSpend[] = []
  for (const nextP of nextGame.players ?? []) {
    const prevPool = (prevGame.players ?? []).find((p) => p.playerId === nextP.playerId)?.manaPool
    if (!prevPool || !nextP.manaPool) continue
    const colors: string[] = []
    for (const [key, symbol] of POOL_SYMBOLS) {
      const spent = (prevPool[key] ?? 0) - (nextP.manaPool[key] ?? 0)
      for (let i = 0; i < spent && colors.length < MAX_ORBS; i++) colors.push(symbol)
    }
    if (colors.length === 0) continue
    const own = added.filter(([, spell]) => (spell.controllerId ?? spell.sourceCard?.controllerId) === nextP.playerId)
    const spellId = (own.length > 0 ? own : added)[own.length > 0 ? own.length - 1 : added.length - 1][0]
    out.push({ playerId: nextP.playerId, colors, spellId })
  }
  return out
}

/** Flies the spent mana from the player's pool display to the stack object (or the stack zone). */
export function flySpentMana(spend: ManaSpend, controlled: boolean, stackRect: DOMRect | null): void {
  const pool = manaPoolElement(controlled ? 'my' : 'opp')
  if (!pool) return
  const target = (spend.spellId ? document.querySelector<HTMLElement>(`[data-card-id="${spend.spellId}"]`)?.getBoundingClientRect() : null) ?? stackRect
  if (!target || target.width <= 0) return
  const from = pool.getBoundingClientRect()
  spend.colors.forEach((color, i) => {
    setTimeout(() => flyManaOrb(from, target, color), i * MANA_SPENT_STAGGER_MS)
  })
}
