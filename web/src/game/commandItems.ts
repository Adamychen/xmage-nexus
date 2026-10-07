import type { PlayerView } from '../net/types'

/** What the UI reads from a command-zone object (emblems, dungeons, the Ring). */
export interface CommandEntry {
  name?: string
  displayName?: string
  cardTypes?: unknown[]
  rules?: string[]
  currentRoom?: string
}

/** The command zone of a player, whichever shape (array or id map) the view carries. */
export function commandItems(p: PlayerView): (CommandEntry | null | undefined)[] {
  const list: unknown = p.commandList
  const items = Array.isArray(list) ? list : typeof list === 'object' ? Object.values(list ?? {}) : []
  return items as (CommandEntry | null | undefined)[]
}
