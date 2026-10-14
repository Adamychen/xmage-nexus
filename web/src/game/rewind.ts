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
  replay: boolean
}

const EMPTY: RewindState = { gameId: null, snapshots: [], viewing: null, replay: false }

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
  if (state.replay) return
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
  publish({ gameId, snapshots, viewing: viewing == null ? null : stillThere ? viewing : snapshots[0].key, replay: false })
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

export const REPLAY_FORMAT = 'nexus-replay'
export const REPLAY_VERSION = 1

export interface ReplayFile {
  format: typeof REPLAY_FORMAT
  version: typeof REPLAY_VERSION
  savedAt: number
  gameId: string | null
  snapshots: RewindSnapshot[]
}

export function buildReplayFile(): ReplayFile | null {
  if (state.replay || state.snapshots.length < 2) return null
  return { format: REPLAY_FORMAT, version: REPLAY_VERSION, savedAt: Date.now(), gameId: state.gameId, snapshots: state.snapshots }
}

function isSnapshot(value: unknown): value is RewindSnapshot {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  const game = v.game as Record<string, unknown> | null | undefined
  return (
    typeof v.key === 'string' &&
    typeof v.turn === 'number' &&
    typeof v.step === 'string' &&
    typeof v.at === 'number' &&
    typeof game === 'object' &&
    game !== null &&
    typeof game.turn === 'number' &&
    Array.isArray(game.players)
  )
}

export function parseReplayFile(raw: unknown): ReplayFile | null {
  if (typeof raw !== 'object' || raw === null) return null
  const f = raw as Record<string, unknown>
  if (f.format !== REPLAY_FORMAT || f.version !== REPLAY_VERSION) return null
  if (!Array.isArray(f.snapshots) || f.snapshots.length < 1 || f.snapshots.length > MAX_REWIND_SNAPSHOTS) return null
  if (!f.snapshots.every(isSnapshot)) return null
  const keys = new Set(f.snapshots.map((s) => (s as RewindSnapshot).key))
  if (keys.size !== f.snapshots.length) return null
  return {
    format: REPLAY_FORMAT,
    version: REPLAY_VERSION,
    savedAt: typeof f.savedAt === 'number' ? f.savedAt : 0,
    gameId: typeof f.gameId === 'string' ? f.gameId : null,
    snapshots: f.snapshots as RewindSnapshot[],
  }
}

export function openReplay(file: ReplayFile): void {
  counter = 0
  publish({ gameId: 'replay', snapshots: file.snapshots, viewing: file.snapshots[0].key, replay: true })
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
