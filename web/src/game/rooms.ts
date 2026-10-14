import { cleanMageText } from './gameEventParser'

/**
 * Duskmourn Room doors tracked from the server chat broadcasts.
 *
 * The engine keeps `leftHalfUnlocked` / `rightHalfUnlocked` /
 * `roomWasUnlockedOnCast` in `PermanentImpl` but copies none of them into
 * `PermanentView` — the only signal is the chat line `PermanentImpl.unlockDoor`
 * informs: `"<player> unlocked the <left|right> door of <Room>
 * (source: <card>)"`. Parsed after `cleanMageText` (the wire wraps names in
 * `<font>` tags and appends `[id]` suffixes); the trailing `(source: …)` is
 * optional and stripped from the card name.
 *
 * Keyed by normalized card name per game (the chat carries no card id). Two
 * copies of the same Room share the badge — accepted edge case.
 */

export interface RoomDoor {
  player: string
  side: 'left' | 'right'
  card: string
}

const ROOM_DOOR_RE = /^(.+?) unlocked the (left|right) door of (.+?)(?:\s*\(source:[^)]*\))?\s*\.?\s*$/i

export function parseRoomDoor(message: string): RoomDoor | null {
  const m = cleanMageText(message).match(ROOM_DOOR_RE)
  if (!m) return null
  return { player: m[1].trim(), side: m[2].toLowerCase() as 'left' | 'right', card: m[3].trim() }
}

const norm = (s: string): string => s.trim().toLowerCase()

export function roomDoorKey(gameId: string, cardName: string): string {
  return `${gameId}‖${norm(cardName)}`
}

export interface RoomDoors {
  left: boolean
  right: boolean
}

export function mergeRoomDoor(prev: RoomDoors | undefined, side: 'left' | 'right'): RoomDoors {
  return { left: prev?.left ?? false, right: prev?.right ?? false, [side]: true }
}

/** Badge label for the unlocked sides: '' (none/unknown) | 'L' | 'R' | 'L·R'. */
export function roomSidesLabel(doors: RoomDoors | undefined): '' | 'L' | 'R' | 'L·R' {
  if (!doors || (!doors.left && !doors.right)) return ''
  if (doors.left && doors.right) return 'L·R'
  return doors.left ? 'L' : 'R'
}
