/**
 * Static dungeon graphs for the venture-into-the-dungeon mechanic.
 *
 * The server (`mage.game.command.dungeons.*Dungeon`) never sends the room graph
 * over the wire — `mage.view.DungeonView` only carries id/name/image/rules and no
 * `currentRoom` exists on any view — so the client models the four canonical
 * dungeons statically. Topology below is transcribed 1:1 from the server's
 * `addNextRoom` links (branching is always binary). Custom/future dungeons fall
 * back to the legacy linear list in `MechanicsTray`.
 */

export interface DungeonRoomDef {
  /** Canonical English room name (matches server prompts verbatim). */
  name: string
  /** i18n key (`game` ns) with the room description. */
  labelKey: string
  /** Index into the label's `/`-separated parts for shared level labels. */
  part?: number
}

export interface DungeonGraph {
  id: string
  /** Lowercase fragments identifying the dungeon by its command-zone name. */
  match: string[]
  /** Rooms grouped by depth (for layered layout). Names must be unique. */
  depths: DungeonRoomDef[][]
  /** Directed edges as canonical room-name pairs. */
  edges: Array<readonly [string, string]>
}

const U = (name: string, labelKey: string, part?: number): DungeonRoomDef => ({ name, labelKey, part })

export const DUNGEON_GRAPHS: DungeonGraph[] = [
  {
    id: 'undercity',
    match: ['undercity'],
    depths: [
      [U('Secret Entrance', 'dungeon_undercity_1')],
      [U('Forge', 'dungeon_undercity_2', 0), U('Lost Well', 'dungeon_undercity_2', 1)],
      [U('Trap!', 'dungeon_undercity_3', 0), U('Arena', 'dungeon_undercity_3', 1), U('Stash', 'dungeon_undercity_4', 0)],
      [U('Archives', 'dungeon_undercity_4', 1), U('Catacombs', 'dungeon_undercity_6')],
      [U('Throne of the Dead Three', 'dungeon_undercity_5')],
    ],
    edges: [
      ['Secret Entrance', 'Forge'],
      ['Secret Entrance', 'Lost Well'],
      ['Forge', 'Trap!'],
      ['Forge', 'Arena'],
      ['Lost Well', 'Arena'],
      ['Lost Well', 'Stash'],
      ['Trap!', 'Archives'],
      ['Arena', 'Archives'],
      ['Arena', 'Catacombs'],
      ['Stash', 'Catacombs'],
      ['Archives', 'Throne of the Dead Three'],
      ['Catacombs', 'Throne of the Dead Three'],
    ],
  },
  {
    id: 'mad-mage',
    match: ['dungeon of the mad mage', 'mad mage'],
    depths: [
      [U('Yawning Portal', 'dungeon_mad_mage_1')],
      [U('Dungeon Level', 'dungeon_mad_mage_2')],
      [U('Goblin Bazaar', 'dungeon_mad_mage_3'), U('Twisted Caverns', 'dungeon_mad_mage_4')],
      [U('Lost Level', 'dungeon_mad_mage_5')],
      [U('Runestone Caverns', 'dungeon_mad_mage_6'), U("Muiral's Graveyard", 'dungeon_mad_mage_8')],
      [U('Deep Mines', 'dungeon_mad_mage_9')],
      [U("Mad Wizard's Lair", 'dungeon_mad_mage_7')],
    ],
    edges: [
      ['Yawning Portal', 'Dungeon Level'],
      ['Dungeon Level', 'Goblin Bazaar'],
      ['Dungeon Level', 'Twisted Caverns'],
      ['Goblin Bazaar', 'Lost Level'],
      ['Twisted Caverns', 'Lost Level'],
      ['Lost Level', 'Runestone Caverns'],
      ['Lost Level', "Muiral's Graveyard"],
      ['Runestone Caverns', 'Deep Mines'],
      ["Muiral's Graveyard", 'Deep Mines'],
      ['Deep Mines', "Mad Wizard's Lair"],
    ],
  },
  {
    id: 'phandelver',
    match: ['lost mine of phandelver', 'phandelver'],
    depths: [
      [U('Cave Entrance', 'dungeon_phandelver_1')],
      [U('Goblin Lair', 'dungeon_phandelver_2', 0), U('Mine Tunnels', 'dungeon_phandelver_2', 1)],
      [U('Storeroom', 'dungeon_phandelver_3', 0), U('Dark Pool', 'dungeon_phandelver_3', 1), U('Fungi Cavern', 'dungeon_phandelver_5')],
      [U('Temple of Dumathoin', 'dungeon_phandelver_4')],
    ],
    edges: [
      ['Cave Entrance', 'Goblin Lair'],
      ['Cave Entrance', 'Mine Tunnels'],
      ['Goblin Lair', 'Storeroom'],
      ['Goblin Lair', 'Dark Pool'],
      ['Mine Tunnels', 'Dark Pool'],
      ['Mine Tunnels', 'Fungi Cavern'],
      ['Storeroom', 'Temple of Dumathoin'],
      ['Dark Pool', 'Temple of Dumathoin'],
      ['Fungi Cavern', 'Temple of Dumathoin'],
    ],
  },
  {
    id: 'tomb',
    match: ['tomb of annihilation'],
    depths: [
      [U('Trapped Entry', 'dungeon_annihilation_1')],
      [U('Veils of Fear', 'dungeon_annihilation_2'), U('Oubliette', 'dungeon_annihilation_5')],
      [U('Sandfall Cell', 'dungeon_annihilation_3')],
      [U('Cradle of the Death God', 'dungeon_annihilation_4')],
    ],
    edges: [
      ['Trapped Entry', 'Veils of Fear'],
      ['Trapped Entry', 'Oubliette'],
      ['Veils of Fear', 'Sandfall Cell'],
      ['Oubliette', 'Cradle of the Death God'],
      ['Sandfall Cell', 'Cradle of the Death God'],
    ],
  },
]

const norm = (s: string): string => s.trim().toLowerCase()

export function findDungeonGraph(dungeonName: string): DungeonGraph | null {
  const key = norm(dungeonName)
  return DUNGEON_GRAPHS.find((g) => g.match.some((m) => key.includes(m))) ?? null
}

export function dungeonRoot(graph: DungeonGraph): string {
  return graph.depths[0][0].name
}

/** Split a shared level label (`A / B`) and pick the room's part. */
export function roomLabel(label: string, room: DungeonRoomDef): string {
  if (room.part === undefined) return label
  const parts = label.split('/').map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) return label
  return parts[Math.min(room.part, parts.length - 1)]
}

function roomByName(graph: DungeonGraph, name: string): DungeonRoomDef | null {
  const key = norm(name)
  for (const depth of graph.depths) {
    const found = depth.find((r) => norm(r.name) === key)
    if (found) return found
  }
  return null
}

/** Shortest root→room path (BFS over explicit edges). Null when unknown. */
export function pathToRoom(graph: DungeonGraph, roomName: string): string[] | null {
  const target = roomByName(graph, roomName)
  if (!target) return null
  const root = dungeonRoot(graph)
  if (target.name === root) return [root]
  const prev = new Map<string, string>()
  const seen = new Set<string>([root])
  const queue: string[] = [root]
  while (queue.length > 0) {
    const cur = queue.shift() as string
    for (const [from, to] of graph.edges) {
      if (from !== cur || seen.has(to)) continue
      seen.add(to)
      prev.set(to, cur)
      if (to === target.name) {
        const path = [to]
        let step: string | undefined = cur
        while (step !== undefined) {
          path.unshift(step)
          step = prev.get(step)
        }
        return path
      }
      queue.push(to)
    }
  }
  return null
}

export function nextRooms(graph: DungeonGraph, roomName: string): string[] {
  return graph.edges.filter(([from]) => from === roomName).map(([, to]) => to)
}

/** Server prompt emitted by `DungeonRoom.chooseNextRoom` (`chooseUse`). */
const VENTURE_PROMPT = /choose which room to go to in/i
const VENTURE_DUNGEON = /dungeon:\s*([^\n]+)/i

export function parseVentureDungeon(message: string): string | null {
  if (!VENTURE_PROMPT.test(message)) return null
  return message.match(VENTURE_DUNGEON)?.[1]?.trim() || null
}

export interface VentureChoice {
  dungeon: string
  room: string
}

/**
 * Map a resolved venture prompt + the clicked option label to a dungeon room.
 * The option labels are the canonical server room names (`UI.left/right.btn.text`).
 */
export function ventureChoiceFromPrompt(message: string, optionLabel: string): VentureChoice | null {
  if (!VENTURE_PROMPT.test(message)) return null
  const fromMessage = parseVentureDungeon(message)
  if (fromMessage) {
    const graph = findDungeonGraph(fromMessage)
    if (graph && roomByName(graph, optionLabel)) return { dungeon: graph.id, room: roomByName(graph, optionLabel)?.name as string }
    if (!graph) return { dungeon: norm(fromMessage), room: optionLabel.trim() }
    return null
  }
  for (const graph of DUNGEON_GRAPHS) {
    const room = roomByName(graph, optionLabel)
    if (room) return { dungeon: graph.id, room: room.name }
  }
  return null
}

/** Server broadcast (`Dungeon.moveToNextRoom`) received by every player. */
const DUNGEON_ENTRY = /^(.+?) has entered (.+?) \(dungeon:\s*([^)]+)\)\s*$/

export function dungeonProgressKey(gameId: string, player: string, dungeon: string): string {
  return `${gameId}‖${norm(player)}‖${norm(dungeon)}`
}

export interface DungeonEntry {
  player: string
  dungeon: string
  room: string
}

export function parseDungeonEntry(message: string): DungeonEntry | null {
  const m = message.match(DUNGEON_ENTRY)
  if (!m) return null
  return { player: m[1].trim(), dungeon: m[3].trim(), room: m[2].trim() }
}

/** Append a visited room (idempotent on repeats, keeps order). */
export function advanceProgress(visited: string[], room: string): string[] {
  if (visited[visited.length - 1] === room) return visited
  return [...visited, room]
}
