import type { GameView } from '../net/types'

/**
 * Board-facing kind of the zone a target lives in. The server declares the
 * Target's `Zone` in `options.targetZone` (`HumanPlayer.getOptions`): HAND,
 * BATTLEFIELD, GRAVEYARD, EXILED, LIBRARY, STACK, COMMAND, OUTSIDE (sideboard)
 * or null for player targets. The board highlights the zone with it, because
 * some cards never make clear where the choice comes from (graveyard, exile,
 * opponent's hand…) and players read that as a bug.
 */
export type TargetZoneKind =
  | 'hand'
  | 'battlefield'
  | 'graveyard'
  | 'exile'
  | 'library'
  | 'stack'
  | 'command'
  | 'sideboard'
  | 'revealed'

const SERVER_ZONE_KINDS: Record<string, TargetZoneKind> = {
  HAND: 'hand',
  BATTLEFIELD: 'battlefield',
  GRAVEYARD: 'graveyard',
  EXILED: 'exile',
  LIBRARY: 'library',
  STACK: 'stack',
  COMMAND: 'command',
  OUTSIDE: 'sideboard',
}

/** `Zone.ALL` is intentionally unmapped: every zone is a legal target and
 *  highlighting all of them would be noise (cards already pulse on their own). */
export function targetZoneKindOf(serverZone: string | null | undefined): TargetZoneKind | null {
  if (!serverZone) return null
  return SERVER_ZONE_KINDS[serverZone.toUpperCase()] ?? null
}

export const EMPTY_TARGET_ZONES: ReadonlySet<TargetZoneKind> = new Set()
export const EMPTY_TARGET_IDS: ReadonlySet<string> = new Set()

export interface TargetZoneHits {
  /** Zones where a target id was actually found in the GameView. */
  zones: Set<TargetZoneKind>
  /** Players owning at least one resolved id (graveyard/exile/battlefield/hand). */
  owners: Set<string>
}

function cardsContainId(cards: unknown, id: string): boolean {
  if (!cards || typeof cards !== 'object' || !id) return false
  const record = cards as Record<string, { id?: string; parentId?: string } | null | undefined>
  const direct = record[id]
  if (direct && typeof direct === 'object') return true
  for (const card of Object.values(record)) {
    if (card && typeof card === 'object' && (card.id === id || card.parentId === id)) return true
  }
  return false
}

/** Does any card of a zone view (by key or id/parentId) match a target id? */
export function cardsContainTarget(cards: unknown, targetIds: ReadonlySet<string>): boolean {
  if (!cards || typeof cards !== 'object' || targetIds.size === 0) return false
  for (const id of targetIds) {
    if (cardsContainId(cards, id)) return true
  }
  return false
}

function commandContains(commandList: unknown, id: string): boolean {
  if (!commandList) return false
  if (Array.isArray(commandList)) {
    return commandList.some((card) => !!card && typeof card === 'object' && (card as { id?: string }).id === id)
  }
  if (typeof commandList === 'object') return cardsContainId(commandList, id)
  return false
}

/**
 * Resolves the target ids against the GameView to learn which zones they live
 * in (and whose). Robust fallback when the prompt carries no `targetZone`, and
 * it scopes the zone per player: a target in the opponent's graveyard
 * highlights THEIR pile, not mine. Player ids are skipped (a player target
 * belongs to no card zone).
 */
export function resolveTargetHits(game: GameView | null, targetIds: readonly string[]): TargetZoneHits {
  const zones = new Set<TargetZoneKind>()
  const owners = new Set<string>()
  if (!game || targetIds.length === 0) return { zones, owners }

  const players = game.players ?? []
  const playerIds = new Set(players.map((p) => p.playerId).filter(Boolean))
  const myId = game.myPlayerId ?? players.find((p) => p.controlled)?.playerId
  const ownerOf = (key: string) => players.find((p) => p.playerId === key || p.name === key)?.playerId ?? key
  const mark = (zone: TargetZoneKind, ownerId?: string | null) => {
    zones.add(zone)
    if (ownerId) owners.add(ownerId)
  }

  for (const id of targetIds) {
    if (!id || playerIds.has(id)) continue
    if (cardsContainId(game.myHand, id)) {
      mark('hand', myId)
      continue
    }
    if (cardsContainId(game.stack, id)) {
      mark('stack')
      continue
    }
    let hit = false
    for (const player of players) {
      if (cardsContainId(player.battlefield, id)) {
        mark('battlefield', player.playerId)
        hit = true
        break
      }
      if (cardsContainId(player.graveyard, id)) {
        mark('graveyard', player.playerId)
        hit = true
        break
      }
      if (cardsContainId(player.exile, id)) {
        mark('exile', player.playerId)
        hit = true
        break
      }
      if (cardsContainId(player.sideboard, id)) {
        mark('sideboard', player.playerId)
        hit = true
        break
      }
      if (player.topCard?.id === id || player.topCard?.parentId === id) {
        mark('library', player.playerId)
        hit = true
        break
      }
      if (commandContains(player.commandList, id)) {
        mark('command', player.playerId)
        hit = true
        break
      }
    }
    if (hit) continue

    for (const [key, hand] of Object.entries(game.opponentHands ?? {})) {
      if (cardsContainId(hand, id)) {
        mark('hand', ownerOf(key))
        hit = true
        break
      }
    }
    if (hit) continue
    for (const [key, hand] of Object.entries(game.watchedHands ?? {})) {
      if (cardsContainId(hand, id)) {
        mark('hand', ownerOf(key))
        hit = true
        break
      }
    }
    if (hit) continue

    for (const group of [...(game.revealed ?? []), ...(game.lookedAt ?? [])]) {
      if (cardsContainId(group.cards, id)) {
        mark('revealed')
        hit = true
        break
      }
    }
    if (hit) continue
    for (const group of game.exiles ?? []) {
      if (cardsContainId(group.cards, id)) {
        mark('exile')
        break
      }
    }
  }

  return { zones, owners }
}
