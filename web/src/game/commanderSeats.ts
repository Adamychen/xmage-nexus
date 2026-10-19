import type { GameView, PlayerView } from '../net/types'
import { commanderDamageDealt, syncCommanderMemory, type MatrixCommander } from '../board/commanders'

export const COMMANDER_LETHAL_DAMAGE = 21
export const COMMANDER_HOT_DAMAGE = 12
export const COMMANDER_CRIT_DAMAGE = 18

export type CommanderTone = 'normal' | 'warning' | 'lethal'

export function commanderTone(dmg: number): CommanderTone {
  if (dmg >= COMMANDER_CRIT_DAMAGE) return 'lethal'
  if (dmg >= COMMANDER_HOT_DAMAGE) return 'warning'
  return 'normal'
}

export interface CommanderSeat {
  ownerId: string
  ownerName: string
  commanders: MatrixCommander[]
}

export function commanderSeats(game: GameView | null | undefined): CommanderSeat[] {
  if (!game) return []
  const roster = syncCommanderMemory(game).filter((c) => !c.isCompanion || c.isCommander)
  const seats: CommanderSeat[] = []
  for (const player of game.players ?? []) {
    const commanders = roster.filter((c) => c.ownerId === player.playerId)
    if (commanders.length > 0) seats.push({ ownerId: player.playerId, ownerName: player.name, commanders })
  }
  return seats
}

export interface SeatDamage {
  seat: CommanderSeat
  dmgs: number[]
  max: number
  tone: CommanderTone
}

export function seatDamage(game: GameView | null | undefined, seat: CommanderSeat, target: PlayerView): SeatDamage {
  const dmgs = seat.commanders.map((c) => commanderDamageDealt(game, c, target))
  const max = dmgs.reduce((a, b) => Math.max(a, b), 0)
  return { seat, dmgs, max, tone: commanderTone(max) }
}

export function formatSeatDamage(dmgs: number[]): string {
  return dmgs.join('/')
}

export interface CommanderThreat {
  owner: string
  victim: string
  commander: string
  remaining: number
}

export function biggestCommanderThreat(game: GameView | null | undefined): CommanderThreat | null {
  if (!game) return null
  let best: (CommanderThreat & { dmg: number }) | null = null
  for (const seat of commanderSeats(game)) {
    for (const target of game.players ?? []) {
      if (target.playerId === seat.ownerId) continue
      for (const commander of seat.commanders) {
        const dmg = commanderDamageDealt(game, commander, target)
        if (dmg <= 0 || dmg >= COMMANDER_LETHAL_DAMAGE) continue
        if (!best || dmg > best.dmg) {
          best = { dmg, owner: seat.ownerName, victim: target.name, commander: commander.name, remaining: COMMANDER_LETHAL_DAMAGE - dmg }
        }
      }
    }
  }
  return best
}
