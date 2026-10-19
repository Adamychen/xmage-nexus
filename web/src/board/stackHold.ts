import { useMemo, useRef, useSyncExternalStore } from 'react'
import type { CardView } from '../net/types'

/** Pause between one spell leaving the stack and the next one starting to resolve. */
const RESOLVE_BEAT_MS = 120

type Stack = Record<string, CardView>
type ResolveRun = (done: () => void) => void
type ResolveTask = { id: string; run: ResolveRun; skip?: () => void }

const EMPTY: Stack = {}
const held = new Map<string, CardView>()
const queue: ResolveTask[] = []
const listeners = new Set<() => void>()
let current: Stack = EMPTY
let shownIds: string[] = []
let shown: Stack = EMPTY
let busy = false
let generation = 0

function notify() {
  listeners.forEach((fn) => fn())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** Current stack order (top first) with the held spells put back where they were. */
function shownOrder(next: Stack, prevIds: string[]): string[] {
  const order = Object.keys(next)
  prevIds.forEach((id, i) => {
    if (order.includes(id) || !held.has(id)) return
    const after = prevIds.slice(i + 1).find((later) => order.includes(later))
    const at = after === undefined ? order.length : order.indexOf(after)
    order.splice(at, 0, id)
  })
  return order
}

function refreshShown() {
  const cards: Stack = {}
  for (const id of shownIds) {
    const card = current[id] ?? held.get(id)
    if (card) cards[id] = card
  }
  shown = cards
}

/**
 * Called while rendering a new view: every spell that left the stack stays on display
 * until its own resolution has played (see `enqueueStackResolve`).
 */
function syncStackHold(prev: Stack, next: Stack) {
  for (const id of Object.keys(prev)) {
    if (!(id in next)) held.set(id, prev[id])
  }
  for (const id of Object.keys(next)) held.delete(id)
  current = next
  shownIds = shownOrder(next, shownIds)
  refreshShown()
}

function releaseHeld(id: string) {
  held.delete(id)
  shownIds = shownIds.filter((x) => x in current || held.has(x))
  refreshShown()
  notify()
}

function pump(gen: number) {
  if (gen !== generation) return
  const task = queue.shift()
  if (!task) {
    busy = false
    return
  }
  if (task.id in current) {
    task.skip?.()
    pump(gen)
    return
  }
  busy = true
  task.run(() => {
    if (gen !== generation) return
    releaseHeld(task.id)
    setTimeout(() => pump(gen), RESOLVE_BEAT_MS)
  })
}

/**
 * Queues the resolution of a spell that left the stack. Resolutions run one at a time, in the
 * order they were queued; `run` must call `done` once its animation has ended, and only then
 * does the spell leave the display and the next one start. `skip` runs instead when the spell
 * came back to the stack before its turn.
 */
export function enqueueStackResolve(id: string, run: ResolveRun, skip?: () => void) {
  queue.push({ id, run, skip })
  if (!busy) pump(generation)
}

function resetStackHold() {
  generation++
  held.clear()
  queue.length = 0
  busy = false
  current = EMPTY
  shownIds = []
  refreshShown()
}

/** A new game: drops every hold and queued resolution of the previous one. */
export function clearStackHold() {
  resetStackHold()
  notify()
}

/**
 * The stack as it is shown: the game's stack plus the spells still resolving, which stay
 * visible until their own resolution ends.
 */
export function useDisplayedStack(game: { stack?: Stack } | null, gameId: string | null): Stack {
  const prevRef = useRef<Stack>(EMPTY)
  const gameIdRef = useRef<string | null>(gameId)
  const next = game?.stack ?? EMPTY
  useMemo(() => {
    if (!game || gameIdRef.current !== gameId) {
      gameIdRef.current = gameId
      prevRef.current = EMPTY
      resetStackHold()
    }
    if (!game) return
    syncStackHold(prevRef.current, next)
    prevRef.current = next
  }, [game, next, gameId])
  return useSyncExternalStore(subscribe, () => shown, () => shown)
}
