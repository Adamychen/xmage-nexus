import { useEffect, useRef, useState } from 'react'
import type { GameView, PlayerView } from '../net/types'
import { useStore, setSeatFocus } from '../state/store'
import { fxMotionAllowed } from './fx'
import { isPlayerOut } from './boardShared'

export interface SeatChoice {
  playerId: string
  combatTurn: number | null
}

export interface SeatFocusInput {
  chosen: SeatChoice | null
  liveOppIds: readonly string[]
  activePlayerId: string | null
  inCombat: boolean
  turn: number
}

export function effectiveFocus({ chosen, liveOppIds, activePlayerId, inCombat, turn }: SeatFocusInput): string | null {
  if (!chosen || liveOppIds.length < 2 || !liveOppIds.includes(chosen.playerId)) return null
  const pickedInThisCombat = chosen.combatTurn != null && chosen.combatTurn === turn
  if (inCombat && !pickedInThisCombat && activePlayerId && liveOppIds.includes(activePlayerId)) return activePlayerId
  return chosen.playerId
}

export function chooseSeat(current: SeatChoice | null, clicked: string, inCombat: boolean, turn: number): SeatChoice | null {
  if (current?.playerId === clicked) return null
  return { playerId: clicked, combatTurn: inCombat ? turn : null }
}

export function liveOpponentIds(players: readonly (PlayerView | undefined)[] | undefined): string[] {
  return (players ?? []).filter((p): p is PlayerView => !!p && !p.controlled && !isPlayerOut(p)).map((p) => p.playerId)
}

export function useSeatFocus(liveOppIds: readonly string[], game: GameView | null) {
  const seatFocus = useStore((s) => s.seatFocus)
  const gameId = useStore((s) => s.gameId)
  const chosen: SeatChoice | null = seatFocus && seatFocus.gameId === gameId
    ? { playerId: seatFocus.playerId, combatTurn: seatFocus.combatTurn }
    : null
  const inCombat = (game?.combat?.length ?? 0) > 0
  const turn = game?.turn ?? 0
  const focusId = effectiveFocus({
    chosen,
    liveOppIds,
    activePlayerId: game?.activePlayerId ?? null,
    inCombat,
    turn,
  })
  const select = (playerId: string) => setSeatFocus(chooseSeat(chosen, playerId, inCombat, turn))
  const showAll = () => setSeatFocus(null)
  return { focusId, select, showAll }
}

export function useBattlefieldPulse(player: PlayerView | undefined, shrunk: boolean): number {
  const key = Object.keys(player?.battlefield ?? {}).sort().join(',')
  const previous = useRef(key)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (previous.current === key) return
    previous.current = key
    if (shrunk && fxMotionAllowed()) setTick((n) => n + 1)
  }, [key, shrunk])
  useEffect(() => {
    if (!shrunk) setTick(0)
  }, [shrunk])
  return tick
}
