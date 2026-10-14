import { cleanMageText } from './gameEventParser'

/**
 * Speed level (Aetherdrift) tracked from the server chat broadcasts.
 *
 * The engine keeps the 1-4 level in `PlayerImpl.speed` but never copies it
 * into `PlayerView` (only the *presence* arrives via `designationNames`), so
 * no DTO client can read it — except that every change is also broadcast:
 * `PlayerImpl.initSpeed/increaseSpeed/decreaseSpeed` inform
 * `"<name>'s speed is now 1."` / `"... has increased to N"` /
 * `"... has decreased to N"`. Same channel as the dungeon-entry broadcasts
 * (`sniffDungeonEntry`), parsed after `cleanMageText` (the wire wraps names
 * in `<font>` tags and appends `[id]` suffixes).
 */

export interface SpeedLevel {
  player: string
  level: number
}

const SPEED_RE = /^(.+?)'s speed (is now|has increased to|has decreased to) ([1-4])\.?\s*$/i

export function parseSpeedLevel(message: string): SpeedLevel | null {
  const m = cleanMageText(message).match(SPEED_RE)
  if (!m) return null
  return { player: m[1].trim(), level: Math.min(4, Math.max(1, parseInt(m[3], 10))) }
}

const norm = (s: string): string => s.trim().toLowerCase()

export function speedLevelKey(gameId: string, player: string): string {
  return `${gameId}‖${norm(player)}`
}
