import type { GameView, PlayerView } from '../net/types'
import { dayNightStateOf } from '../board/dayNight'
import { commandItems } from './commandItems'
import { dungeonProgressKey, dungeonRoot, findDungeonGraph, pathToRoom, type DungeonGraph } from './dungeons'

export const RING_MAX_LEVEL = 4
export const SPEED_MAX = 4

const KNOWN_DUNGEONS = ['undercity', 'dungeon of the mad mage', 'lost mine of phandelver', 'tomb of annihilation']

export interface RingState {
  level: number
  bearerName?: string
  player: PlayerView
}

export interface DungeonState {
  name: string
  player: PlayerView
  graph: DungeonGraph | null
  visited: string[]
  current: string | null
  depth: number | null
  depthCount: number | null
}

export function findRingBearer(player: PlayerView): string | undefined {
  for (const perm of Object.values(player.battlefield ?? {})) {
    if ((perm.cardIcons ?? []).some((icon) => icon.cardIconType === 'RINGBEARER')) {
      return perm.displayName || perm.name || 'Creature'
    }
  }
  return undefined
}

export function ringStateOf(player: PlayerView): RingState | null {
  const ring = commandItems(player).find((c) => String(c?.name ?? '').toLowerCase().startsWith('the ring'))
  if (!ring) return null
  const level = Math.min(RING_MAX_LEVEL, Math.max(1, (ring.rules ?? []).length))
  return { level, bearerName: findRingBearer(player), player }
}

export function dungeonStateOf(
  player: PlayerView,
  gameId: string | null | undefined,
  progress: Record<string, string[]>,
): DungeonState | null {
  const item = commandItems(player).find((c) => {
    const n = String(c?.name ?? '').toLowerCase()
    const types = Array.isArray(c?.cardTypes) ? c.cardTypes.map((t) => String(t).toLowerCase()) : []
    return types.includes('dungeon') || KNOWN_DUNGEONS.some((k) => n.includes(k))
  })
  if (!item?.name) return null
  const graph = findDungeonGraph(item.name)
  if (!graph) return { name: item.name, player, graph: null, visited: [], current: null, depth: null, depthCount: null }
  const root = dungeonRoot(graph)
  const tracked = gameId ? progress[dungeonProgressKey(gameId, player.name, graph.id)] : undefined
  const visited =
    tracked && tracked.length > 0
      ? tracked
      : item.currentRoom
        ? pathToRoom(graph, item.currentRoom) ?? (root ? [root] : [])
        : root
          ? [root]
          : []
  const current = visited[visited.length - 1] ?? null
  const at = current ? graph.depths.findIndex((rooms) => rooms.some((r) => r.name === current)) : -1
  return {
    name: item.name,
    player,
    graph,
    visited,
    current,
    depth: at >= 0 ? at + 1 : null,
    depthCount: graph.depths.length,
  }
}

export function speedOf(player: PlayerView): number | null {
  const counter = (player.counters ?? []).find((c) => c.name.toLowerCase().includes('speed') && c.count > 0)
  if (counter) return counter.count
  const designation = (player.designationNames ?? []).find((d) => d.toLowerCase().includes('speed'))
  if (!designation) return null
  const n = Number(/\d+/.exec(designation)?.[0])
  return Number.isFinite(n) && n > 0 ? n : 1
}

export function hasCityBlessing(player: PlayerView): boolean {
  return (player.designationNames ?? []).some((d) => d.toLowerCase().includes('blessing'))
}

export function activeMechanicsCount(game: GameView | null | undefined): number {
  if (!game) return 0
  const players = game.players ?? []
  let count = dayNightStateOf(game) ? 1 : 0
  for (const p of players) {
    if (ringStateOf(p)) count++
    if (dungeonStateOf(p, null, {})) count++
    if (p.monarch) count++
    if (p.initiative) count++
    if (hasCityBlessing(p)) count++
    if (speedOf(p) != null) count++
  }
  return count
}
