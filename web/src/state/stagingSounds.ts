import { soundManager } from '../audio/soundManager'
import type { SeatView, TableView } from '../net/types'

export function stagingRosterNames(seats?: SeatView[] | null): string[] {
  if (!seats) return []
  const names: string[] = []
  for (const s of seats) {
    const name = s?.playerName?.trim()
    if (name) names.push(name)
  }
  return names
}

export function diffStagingRoster(
  prevSeats?: SeatView[] | null,
  nextSeats?: SeatView[] | null,
  ownName?: string | null,
): { joined: string[]; left: string[] } {
  const prev = new Set(stagingRosterNames(prevSeats))
  const next = new Set(stagingRosterNames(nextSeats))
  const joined = [...next].filter((n) => !prev.has(n) && n !== ownName)
  const left = [...prev].filter((n) => !next.has(n) && n !== ownName)
  return { joined, left }
}

export function notifyStagingRoster(
  prevTable: TableView | undefined,
  nextTable: TableView | undefined,
  ownName?: string | null,
): void {
  if (!prevTable || !nextTable) return
  const { joined, left } = diffStagingRoster(prevTable.seats, nextTable.seats, ownName)
  if (joined.length > 0) soundManager.play('player_join', 'ui')
  if (left.length > 0) soundManager.play('player_leave', 'ui')
}
