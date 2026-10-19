import { useSyncExternalStore } from 'react'
import type { GameView } from '../net/types'
import { soundManager } from '../audio/soundManager'
import { fxDuration, fxEnabled, fxMotionAllowed } from './fx'
import { seatColorVar, seatIndexOf } from './seatColor'

export const COIN_FLIP_MS = 1400

export interface CoinFlipFx {
  id: number
  name: string
  color: string
  spin: boolean
  duration: number
}

let state: CoinFlipFx | null = null
let counter = 0
let timer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()
/** Game ids whose coin already ran or was skipped. */
const flipped = new Set<string>()

function notify() {
  listeners.forEach((fn) => fn())
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

function getSnapshot(): CoinFlipFx | null {
  return state
}

export function useCoinFlipFx(): CoinFlipFx | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function clearCoinFlipFx(): void {
  clearTimeout(timer)
  state = null
  notify()
}

/** Shows the coin for `name` and plays the toss. Returns its duration, or 0 when effects are off. */
export function startCoinFlip(name: string, color: string): number {
  if (!fxEnabled()) return 0
  const duration = fxDuration(COIN_FLIP_MS)
  const id = ++counter
  soundManager.play('coin_flip', 'game')
  state = { id, name, color, spin: fxMotionAllowed(), duration }
  notify()
  clearTimeout(timer)
  timer = setTimeout(() => {
    if (state?.id !== id) return
    state = null
    notify()
  }, duration + 60)
  return duration
}

/**
 * Called on every game view. Runs the coin once per game, on the first view with turn >= 1 and a
 * phase and step set (the mulligan views have both null). The winner is the active player at that
 * view: the server does not send the real flip, so the coin is cosmetic. Returns the coin duration
 * when it starts for this view (so the turn banner can wait for it), else 0.
 */
export function observeCoinFlip(game: GameView | null, gameId: string | null): number {
  if (!game || !gameId || flipped.has(gameId)) return 0
  if (game.turn !== 1 || game.phase == null || game.step == null) return 0
  flipped.add(gameId)
  const players = game.players ?? []
  const first = players.find((p) => p.playerId === game.activePlayerId) ?? players.find((p) => p.isActive)
  const name = first?.name ?? game.activePlayerName ?? ''
  if (!name) return 0
  return startCoinFlip(name, seatColorVar(seatIndexOf(players, first?.playerId)))
}

/** Lets the same game run its coin again (the gallery replays it). */
export function forgetCoinFlip(gameId: string): void {
  flipped.delete(gameId)
}
