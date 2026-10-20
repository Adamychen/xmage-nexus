import type { CardView, GameView, PlayerView } from '../net/types'
import { parseCommandList } from './CommandZone'
import { commandItems } from '../game/commandItems'

const DUNGEON_NAMES = ['undercity', 'dungeon of the mad mage', 'lost mine of phandelver', 'tomb of annihilation']
const CURRENT_ROOM = /\(Currently in ([^)]+)\)/i

export interface DungeonEntry {
  id: string
  name: string
  /** The room the venture is in, read from the dungeon's rules ("(Currently in Goblin Lair)"). */
  room: string | null
}

/** The dungeon a player is venturing through, as the server sends it in the command list. */
export function dungeonOf(player: PlayerView | undefined): DungeonEntry | null {
  if (!player) return null
  for (const item of commandItems(player)) {
    const name = String(item?.name ?? '').trim()
    const types = Array.isArray(item?.cardTypes) ? item.cardTypes.map((t) => String(t).toLowerCase()) : []
    if (!item || (!types.includes('dungeon') && !DUNGEON_NAMES.some((d) => name.toLowerCase().includes(d)))) continue
    const room = (item.rules ?? []).map((line) => CURRENT_ROOM.exec(String(line))?.[1]?.trim()).find((r): r is string => !!r)
    return { id: String((item as { id?: string }).id ?? name), name, room: room ?? item.currentRoom ?? null }
  }
  return null
}

export interface CommandArrivals {
  /** Emblems new to a player's command zone. */
  emblems: Array<{ playerId: string; id: string; card: CardView }>
  /** A dungeon a player started (`entered`), or one whose current room changed. */
  dungeons: Array<{ playerId: string; dungeon: DungeonEntry; entered: boolean }>
  /** The plane that replaced another (a planeswalk), or the first one. */
  planes: Array<{ id: string; card: CardView; replaced: boolean }>
}

function samePlayer(a: PlayerView, b: PlayerView): boolean {
  return a.playerId === b.playerId || a.name === b.name
}

/**
 * What changed in the command zones in this update: emblems that arrived (a planeswalker's
 * ultimate), a dungeon started or advanced to another room, and a new plane (Planechase). A plane
 * is universal, so every player's list carries it and it is reported once.
 */
export function commandArrivals(prevGame: GameView | null | undefined, nextGame: GameView | null | undefined): CommandArrivals {
  const out: CommandArrivals = { emblems: [], dungeons: [], planes: [] }
  if (!prevGame || !nextGame) return out
  const prevPlanes = new Set<string>()
  for (const p of prevGame.players ?? []) {
    for (const item of parseCommandList(p.commandList)) if (item.isPlane) prevPlanes.add(item.id)
  }
  const seenPlanes = new Set<string>()
  for (const nextP of nextGame.players ?? []) {
    const prevP = (prevGame.players ?? []).find((p) => samePlayer(p, nextP))
    if (!prevP) continue
    const before = new Set(parseCommandList(prevP.commandList).map((item) => item.id))
    for (const item of parseCommandList(nextP.commandList)) {
      if (item.isEmblem && !before.has(item.id)) out.emblems.push({ playerId: nextP.playerId, id: item.id, card: item.card })
      if (item.isPlane && !prevPlanes.has(item.id) && !seenPlanes.has(item.id)) {
        seenPlanes.add(item.id)
        out.planes.push({ id: item.id, card: item.card, replaced: prevPlanes.size > 0 })
      }
    }
    const was = dungeonOf(prevP)
    const now = dungeonOf(nextP)
    if (now && (!was || was.id !== now.id)) out.dungeons.push({ playerId: nextP.playerId, dungeon: now, entered: true })
    else if (now && was && now.room && now.room !== was.room) out.dungeons.push({ playerId: nextP.playerId, dungeon: now, entered: false })
  }
  return out
}
