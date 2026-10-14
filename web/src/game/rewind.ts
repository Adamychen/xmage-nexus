import { useSyncExternalStore } from 'react'
import type { GameView } from '../net/types'

export const MAX_REWIND_SNAPSHOTS = 40

export interface RewindSnapshot {
  key: string
  turn: number
  step: string
  at: number
  game: GameView
}

export interface RewindState {
  gameId: string | null
  snapshots: RewindSnapshot[]
  viewing: string | null
}

const EMPTY: RewindState = { gameId: null, snapshots: [], viewing: null }

let state: RewindState = EMPTY
let counter = 0
const listeners = new Set<() => void>()

function publish(next: RewindState) {
  state = next
  listeners.forEach((fn) => fn())
}

export function getRewind(): RewindState {
  return state
}

export function captureRewind(gameId: string | null, game: GameView | null | undefined): void {
  if (!game || typeof game.turn !== 'number') return
  const step = String(game.step ?? '')
  let snapshots = state.gameId === gameId ? state.snapshots : []
  const viewing = state.gameId === gameId ? state.viewing : null
  if (state.gameId !== gameId) counter = 0
  const last = snapshots[snapshots.length - 1]
  if (last && game.turn < last.turn) {
    snapshots = snapshots.filter((s) => s.turn <= game.turn)
  }
  const tail = snapshots[snapshots.length - 1]
  if (tail && tail.turn === game.turn && tail.step === step) {
    snapshots = [...snapshots.slice(0, -1), { ...tail, at: Date.now(), game }]
  } else {
    counter += 1
    snapshots = [...snapshots, { key: `${game.turn}:${step}:${counter}`, turn: game.turn, step, at: Date.now(), game }]
  }
  if (snapshots.length > MAX_REWIND_SNAPSHOTS) snapshots = snapshots.slice(snapshots.length - MAX_REWIND_SNAPSHOTS)
  const stillThere = viewing != null && snapshots.some((s) => s.key === viewing)
  publish({ gameId, snapshots, viewing: viewing == null ? null : stillThere ? viewing : snapshots[0].key })
}

export function viewRewind(key: string | null): void {
  if (key != null && !state.snapshots.some((s) => s.key === key)) return
  if (state.viewing === key) return
  publish({ ...state, viewing: key })
}

export function stepRewind(delta: number): void {
  const { snapshots, viewing } = state
  if (snapshots.length === 0) return
  const current = viewing == null ? snapshots.length - 1 : snapshots.findIndex((s) => s.key === viewing)
  const next = Math.min(snapshots.length - 1, Math.max(0, current + delta))
  viewRewind(snapshots[next].key)
}

export function clearRewind(): void {
  counter = 0
  if (state !== EMPTY) publish(EMPTY)
}

export function viewedSnapshot(s: RewindState): RewindSnapshot | null {
  if (s.viewing == null) return null
  return s.snapshots.find((snap) => snap.key === s.viewing) ?? null
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function useRewind(): RewindState {
  return useSyncExternalStore(subscribe, getRewind, getRewind)
}
