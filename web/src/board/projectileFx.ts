import { useSyncExternalStore } from 'react'
import { fxMotionDuration } from './fx'
import type { ManaColor } from './impactFx'
import { soundManager } from '../audio/soundManager'

type Rect = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>
export interface Point {
  x: number
  y: number
}

export interface ProjectileFx {
  id: number
  from: Point
  /** Re-measured every frame: the board can still move while the projectile flies. */
  measureTo: () => Rect | null
  to0: Point
  duration: number
  colors: ManaColor[]
}

const MIN_MS = 260
const MAX_MS = 480
const MAX_PROJECTILES = 12

let projectiles: ProjectileFx[] = []
let counter = 0
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((fn) => fn())
}

export function subscribeProjectiles(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function getProjectiles(): ProjectileFx[] {
  return projectiles
}

export function useProjectiles(): ProjectileFx[] {
  return useSyncExternalStore(subscribeProjectiles, getProjectiles, getProjectiles)
}

export function clearProjectiles() {
  projectiles = []
  notify()
}

/** Flight time for a projectile covering `distance` px; longer shots take longer, within bounds. */
export function projectileFlightMs(distance: number): number {
  return Math.round(Math.min(MAX_MS, Math.max(MIN_MS, MIN_MS + distance * 0.25)))
}

function centreOf(rect: Rect): Point {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

/**
 * Launches a projectile from the centre of `from` toward the centre of whatever `measureTo`
 * reports while it flies. Returns the flight time in ms so the caller can hold the hit, or 0
 * when nothing was launched (motion disabled, or the target is not on screen). `onLand` runs
 * on arrival.
 */
export function spawnProjectile(from: Rect, measureTo: () => Rect | null, colors: ManaColor[] = [], onLand?: () => void): number {
  const target = measureTo()
  if (!target) return 0
  const start = centreOf(from)
  const to0 = centreOf(target)
  const duration = fxMotionDuration(projectileFlightMs(Math.hypot(to0.x - start.x, to0.y - start.y)))
  if (!duration) return 0
  const inFlight = projectiles.find((p) => p.from.x === start.x && p.from.y === start.y && p.to0.x === to0.x && p.to0.y === to0.y)
  if (inFlight) {
    if (onLand) setTimeout(onLand, inFlight.duration)
    return inFlight.duration
  }
  const item: ProjectileFx = { id: ++counter, from: start, measureTo, to0, duration, colors }
  projectiles = [...projectiles, item].slice(-MAX_PROJECTILES)
  notify()
  soundManager.play('projectile_launch', 'game')
  setTimeout(() => {
    projectiles = projectiles.filter((p) => p.id !== item.id)
    notify()
    soundManager.play('projectile_impact', 'game')
    onLand?.()
  }, duration)
  return duration
}
