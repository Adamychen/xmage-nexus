import { useSyncExternalStore } from 'react'
import { cleanMageText } from '../game/gameEventParser'
import { getState } from '../state/state'
import { soundManager } from '../audio/soundManager'
import { fxDuration, fxEnabled, fxMotionAllowed } from './fx'
import { seatColorVar, seatIndexOf } from './seatColor'

export const DICE_ROLL_MS = 1500
const MAX_DICE = 4

export interface DiceRoll {
  player: string
  /** Sides of a numerical die; null for the planar die. */
  sides: number | null
  results: string[]
}

export interface DiceRollFx extends DiceRoll {
  id: number
  color: string
  spin: boolean
  duration: number
}

/**
 * `PlayerImpl.rollDiceInner` reports a roll only as game-log text, never in the `GameView`:
 * "[Roll a die] <name> rolled a d20, result: 14 (source: …)",
 * "[Roll a die] <name> rolled 2d6, results: [4, 6], ignoring [1, 3] (source: …)",
 * "[Roll a planar die] <name> rolled Chaos Roll (source: …)".
 */
const NUMERICAL_RE = /^\[Roll a die\] (.+?) rolled (?:a |\d+)d(\d+), results?: (\[[^\]]*\]|[^\s,(]+)/i
const PLANAR_RE = /^\[Roll a planar die\] (.+?) rolled (\[[^\]]*\]|.+?)(?:, ignoring .*?)?(?: \(source: .*\))?$/i

function splitResults(raw: string): string[] {
  const inner = raw.startsWith('[') ? raw.slice(1, -1) : raw
  return inner.split(',').map((r) => r.trim()).filter(Boolean)
}

export function parseDiceRoll(message: string): DiceRoll | null {
  const text = cleanMageText(message)
  const numerical = NUMERICAL_RE.exec(text)
  if (numerical) {
    return { player: numerical[1].trim(), sides: parseInt(numerical[2], 10), results: splitResults(numerical[3]) }
  }
  const planar = PLANAR_RE.exec(text)
  if (planar) return { player: planar[1].trim(), sides: null, results: splitResults(planar[2].trim()) }
  return null
}

let state: DiceRollFx | null = null
let counter = 0
let timer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((fn) => fn())
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

function getSnapshot(): DiceRollFx | null {
  return state
}

export function useDiceRollFx(): DiceRollFx | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function clearDiceRollFx(): void {
  clearTimeout(timer)
  state = null
  notify()
}

/** Throws the dice for `roll` at the centre of the board. Returns the duration, or 0 when effects are off. */
export function startDiceRoll(roll: DiceRoll, color: string): number {
  if (!fxEnabled() || roll.results.length === 0) return 0
  const duration = fxDuration(DICE_ROLL_MS)
  const id = ++counter
  soundManager.play('dice_roll', 'game')
  state = { ...roll, results: roll.results.slice(0, MAX_DICE), id, color, spin: fxMotionAllowed(), duration }
  notify()
  clearTimeout(timer)
  timer = setTimeout(() => {
    if (state?.id !== id) return
    state = null
    notify()
  }, duration + 60)
  return duration
}

/** Game-log hook: a roll by a player of the current game throws the dice in that player's seat colour. */
export function sniffDiceRoll(message: string, gameId: string | null | undefined): void {
  if (!gameId) return
  const roll = parseDiceRoll(message)
  if (!roll) return
  const s = getState()
  if (s.gameId !== gameId) return
  const players = s.game?.players ?? []
  const named = roll.player.toLowerCase()
  const player = players.find((p) => p.name.trim().toLowerCase() === named)
  startDiceRoll(roll, seatColorVar(seatIndexOf(players, player?.playerId)))
}
