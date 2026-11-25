import type { GameView, PlayerView } from '../net/types'

/** One combat group as the board draws it: the attacker (or the band) with the blockers in front. */
export interface CombatColumn {
  /** The group's attackers, in the order the view lists them; a band attacks as one column. */
  attackerIds: string[]
  /** The creatures blocking that group, fanned in front of it. */
  blockerIds: string[]
}

/** Everything coming at one defender: their columns and the attackers nothing stops. */
export interface CombatTarget {
  defenderId: string
  /** A seat's avatar, or a permanent of theirs (a planeswalker, a battle). */
  kind: 'player' | 'permanent'
  columns: CombatColumn[]
  /** The attackers of this defender with no blocker: the damage that lands, and the only beam left. */
  unblockedIds: string[]
}

export interface CombatArrangement {
  /** One entry per defender under attack, in the order the view lists the groups. */
  targets: CombatTarget[]
  /** Creatures of each seat that are in a column, by controller id. */
  engagedIds: Record<string, string[]>
  /** Groups whose defender the view does not name: they keep their arrow rather than a column. */
  strays: CombatColumn[]
}

const EMPTY: CombatArrangement = { targets: [], engagedIds: {}, strays: [] }

/** The ids of an `attackers`/`blockers` field, which the proxy sends as a map and the schema allows as a list. */
function idsOf(field: unknown): string[] {
  if (Array.isArray(field)) return field.map((id) => String(id)).filter(Boolean)
  if (field && typeof field === 'object') return Object.keys(field as Record<string, unknown>)
  return []
}

function controllerOf(players: PlayerView[], cardId: string): string | null {
  for (const player of players) {
    if (cardId in (player.battlefield ?? {})) return player.playerId ?? null
  }
  return null
}

function defenderKind(players: PlayerView[], defenderId: string): 'player' | 'permanent' | null {
  if (players.some((p) => p.playerId === defenderId)) return 'player'
  return controllerOf(players, defenderId) ? 'permanent' : null
}

/**
 * CMB-14: a declared combat as the board arranges it. The pairing is the server's: one column per
 * combat group, grouped by the defender the group names. A group whose defender the view does not
 * name is not placed, so nothing is invented from whose turn it is.
 */
export function combatArrangement(game: GameView | null | undefined): CombatArrangement {
  const groups = game && Array.isArray(game.combat) ? game.combat : null
  if (!groups || groups.length === 0) return EMPTY
  const players = (game?.players ?? []) as PlayerView[]

  const byDefender = new Map<string, CombatTarget>()
  const order: string[] = []
  const strays: CombatColumn[] = []
  const engagedIds: Record<string, string[]> = {}

  const engage = (cardId: string) => {
    const controller = controllerOf(players, cardId)
    if (!controller) return
    const list = engagedIds[controller] ?? (engagedIds[controller] = [])
    if (!list.includes(cardId)) list.push(cardId)
  }

  for (const group of groups) {
    const record = (group ?? {}) as Record<string, unknown>
    const attackerIds = idsOf(record.attackers)
    if (attackerIds.length === 0) continue
    const blockerIds = idsOf(record.blockers)
    const column: CombatColumn = { attackerIds, blockerIds }

    const defenderId = typeof record.defenderId === 'string' ? record.defenderId : ''
    const kind = defenderId ? defenderKind(players, defenderId) : null
    if (!defenderId || !kind) {
      strays.push(column)
      continue
    }

    let target = byDefender.get(defenderId)
    if (!target) {
      target = { defenderId, kind, columns: [], unblockedIds: [] }
      byDefender.set(defenderId, target)
      order.push(defenderId)
    }
    target.columns.push(column)
    if (blockerIds.length === 0) target.unblockedIds.push(...attackerIds)
    for (const id of [...attackerIds, ...blockerIds]) engage(id)
  }

  return { targets: order.map((id) => byDefender.get(id)!), engagedIds, strays }
}

/** The creatures of a seat that combat leaves alone: everything on its battlefield that holds no column. */
export function atEaseIds(arrangement: CombatArrangement, player: PlayerView | undefined): string[] {
  const battlefield = player?.battlefield ?? {}
  const engaged = new Set(arrangement.engagedIds[player?.playerId ?? ''] ?? [])
  return Object.keys(battlefield).filter((id) => !engaged.has(id))
}

/**
 * CMB-14: the column each creature belongs to, numbered across the whole combat. Both sides of a
 * group get the same number, so an attacker and the creatures blocking it sit at the same place in
 * their own boards and the pairing reads across the table without a line.
 */
export function combatOrder(arrangement: CombatArrangement): Map<string, number> {
  const order = new Map<string, number>()
  let column = 0
  for (const target of arrangement.targets) {
    for (const group of target.columns) {
      for (const id of [...group.attackerIds, ...group.blockerIds]) order.set(id, column)
      column += 1
    }
  }
  return order
}
