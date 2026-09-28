import { useEffect, useRef, useState } from 'react'
import type { GameView } from '../net/types'
import type { FeedbackPrompt } from './feedback'
import { controlInfo } from '../state/control'
import { isUnlimitedTime } from '../utils/timer'

export const LONG_WAIT_SECS = 60

export interface WaitingState {
  playerId: string
  name: string
  timeLeftSecs: number | null
  key: string
  preGame: boolean
}

export function isPreGame(game: GameView): boolean {
  return !game.step && !game.phase
}

export function waitingState(game: GameView | null, feedback: FeedbackPrompt | null, waitingFor: string | null = null): WaitingState | null {
  if (!game || feedback) return null
  const players = game.players ?? []
  const me = players.find((p) => p.controlled)
  if (me?.hasPriority) return null
  if (controlInfo(game).priorityIsControlled) return null
  const preGame = isPreGame(game)
  const holder =
    players.find((p) => p !== me && p.hasPriority) ??
    (game.priorityPlayerName ? players.find((p) => p !== me && p.name === game.priorityPlayerName) : undefined) ??
    (waitingFor ? players.find((p) => p !== me && p.name === waitingFor) : undefined)
  if (!holder) {
    if (!preGame || !me) return null
    const name = waitingFor && waitingFor !== me.name ? waitingFor : ''
    return { playerId: '', name, timeLeftSecs: null, key: `pregame|${game.turn}|${name}`, preGame }
  }
  const secs = holder.priorityTimeLeftSecs
  const timeLeftSecs = typeof secs === 'number' && secs > 0 && !isUnlimitedTime(secs) ? secs : null
  const stackKey = Object.keys(game.stack ?? {}).join(',')
  return {
    playerId: holder.playerId,
    name: holder.name,
    timeLeftSecs,
    key: `${holder.playerId}|${game.turn}|${game.step ?? ''}|${stackKey}`,
    preGame,
  }
}

const WAITING_FOR_RE = /(?:^|\s-\s)Waiting for\s+(.+?)\s*$/i

export function waitingForName(message: string): string | null {
  const match = WAITING_FOR_RE.exec(message.replace(/<[^>]*>/g, '').trim())
  return match ? match[1] : null
}

export function formatElapsed(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function useElapsedSeconds(key: string | null): number {
  const startRef = useRef<{ key: string | null; start: number }>({ key, start: Date.now() })
  if (startRef.current.key !== key) startRef.current = { key, start: Date.now() }
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!key) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [key])

  if (!key) return 0
  return Math.max(0, Math.floor((now - startRef.current.start) / 1000))
}
