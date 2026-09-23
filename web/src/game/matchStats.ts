import type { CardView, GameView, PermanentView, PlayerView } from '../net/types'
import { stringList } from '../state/gameUtils'
import { isAbilityCard } from '../cards/cardImages'

export interface MatchStats {
  gameId: string | null
  turns: number
  lifeTaken: number
  lifeLost: number
  spellsCast: number
  creaturesKilled: number
  attacks: Record<string, number>
  attackers: Record<string, PermanentView>
  biggestSpell: CardView | null
}

function empty(gameId: string | null): MatchStats {
  return {
    gameId,
    turns: 0,
    lifeTaken: 0,
    lifeLost: 0,
    spellsCast: 0,
    creaturesKilled: 0,
    attacks: {},
    attackers: {},
    biggestSpell: null,
  }
}

let stats: MatchStats = empty(null)

export function resetMatchStats(gameId: string | null = null): void {
  stats = empty(gameId)
}

export function getMatchStats(): MatchStats {
  return stats
}

function isCreature(card: CardView | undefined): boolean {
  return (card?.cardTypes ?? []).some((t) => String(t).toUpperCase() === 'CREATURE')
}

function attackerIds(game: GameView): Set<string> {
  const ids = new Set<string>()
  for (const group of game.combat ?? []) {
    stringList((group as { attackers?: unknown }).attackers).forEach((id) => ids.add(id))
  }
  return ids
}

function samePlayer(a: PlayerView, b: PlayerView): boolean {
  return a.playerId === b.playerId || a.name === b.name
}

export function recordMatchStats(prev: GameView | null, next: GameView, gameId: string | null): void {
  if (gameId !== stats.gameId) resetMatchStats(gameId)
  if (typeof next.turn === 'number') stats.turns = Math.max(stats.turns, next.turn)
  if (!prev) return
  const me = next.players?.find((p) => p.controlled)
  if (!me) return
  const prevPlayers = prev.players ?? []

  for (const p of next.players ?? []) {
    const before = prevPlayers.find((q) => samePlayer(q, p))
    if (!before || typeof before.life !== 'number' || typeof p.life !== 'number') continue
    const lost = before.life - p.life
    if (lost <= 0) continue
    if (p.controlled) stats.lifeLost += lost
    else stats.lifeTaken += lost
  }

  const prevStack = prev.stack ?? {}
  for (const [id, item] of Object.entries(next.stack ?? {})) {
    if (id in prevStack || isAbilityCard(item)) continue
    const controller = item.controllerId ?? item.sourceCard?.controllerId
    const controllerName = item.controllerName ?? item.sourceCard?.controllerName
    if (controller !== me.playerId && controllerName !== me.name) continue
    stats.spellsCast += 1
    if (!stats.biggestSpell || (item.manaValue ?? 0) > (stats.biggestSpell.manaValue ?? 0)) stats.biggestSpell = item
  }

  const before = attackerIds(prev)
  for (const id of attackerIds(next)) {
    if (before.has(id)) continue
    const perm = me.battlefield?.[id]
    if (!perm) continue
    stats.attacks[id] = (stats.attacks[id] ?? 0) + 1
    stats.attackers[id] = perm
  }

  const graveIds = new Set<string>()
  for (const p of next.players ?? []) Object.keys(p.graveyard ?? {}).forEach((id) => graveIds.add(id))
  for (const p of prevPlayers) {
    if (p.controlled || samePlayer(p, me)) continue
    const now = (next.players ?? []).find((q) => samePlayer(q, p))
    for (const [id, perm] of Object.entries(p.battlefield ?? {})) {
      if (now?.battlefield && id in now.battlefield) continue
      if (isCreature(perm) && graveIds.has(id)) stats.creaturesKilled += 1
    }
  }
}

function powerOf(card: CardView | undefined): number {
  const n = Number.parseInt(String(card?.power ?? ''), 10)
  return Number.isFinite(n) ? n : 0
}

export function keyCardOf(s: MatchStats): CardView | null {
  let best: PermanentView | null = null
  let bestAttacks = 0
  for (const [id, count] of Object.entries(s.attacks)) {
    const card = s.attackers[id]
    if (!card) continue
    if (count > bestAttacks || (count === bestAttacks && powerOf(card) > powerOf(best ?? undefined))) {
      best = card
      bestAttacks = count
    }
  }
  return best ?? s.biggestSpell
}
