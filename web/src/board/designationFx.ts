import { useSyncExternalStore } from 'react'
import type { GameView } from '../net/types'
import { soundManager } from '../audio/soundManager'
import { fxMotionDuration } from './fx'
import { spawnImpact } from './impactFx'

export type PassedDesignation = 'monarch' | 'initiative'

export interface DesignationFx {
  id: number
  kind: PassedDesignation
  /** Destination centre. */
  x: number
  y: number
  /** Start offset from the destination; a designation nobody held drops from above. */
  fromX: number
  fromY: number
  fresh: boolean
  duration: number
}

const FLIGHT_MS = 950
const DROP_FROM_PX = 140

let active: DesignationFx[] = []
let counter = 0
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

export function getDesignationFlights(): DesignationFx[] {
  return active
}

export function useDesignationFlights(): DesignationFx[] {
  return useSyncExternalStore(subscribe, getDesignationFlights, getDesignationFlights)
}

export function clearDesignationFlights(): void {
  active = []
  notify()
}

const BADGE_CLASS: Record<PassedDesignation, string> = { monarch: 'badge-monarch', initiative: 'badge-initiative' }

function visibleRect(el: Element | null | undefined): DOMRect | null {
  if (!el) return null
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 ? r : null
}

function seatRect(playerId: string, kind?: PassedDesignation): DOMRect | null {
  const bar = `.player-info-bar[data-player-id="${playerId}"]`
  return (kind ? visibleRect(document.querySelector(`${bar} .${BADGE_CLASS[kind]}`)) : null)
    ?? visibleRect(document.querySelector(`${bar} .player-avatar`))
    ?? visibleRect(document.querySelector(bar))
    ?? visibleRect(document.querySelector(`[data-player-id="${playerId}"]`))
}

const centre = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 })

/** The crown (or the initiative) flies from the portrait that held it to its new holder; nothing when effects are off. */
export function spawnDesignationFlight(kind: PassedDesignation, fromPlayerId: string | null, toPlayerId: string): DesignationFx | null {
  if (typeof document === 'undefined') return null
  const duration = fxMotionDuration(FLIGHT_MS)
  if (!duration) return null
  const toRect = seatRect(toPlayerId, kind)
  if (!toRect) return null
  const to = centre(toRect)
  const fromRect = fromPlayerId ? seatRect(fromPlayerId) : null
  const from = fromRect ? centre(fromRect) : { x: to.x, y: to.y - DROP_FROM_PX }
  const item: DesignationFx = {
    id: ++counter,
    kind,
    x: to.x,
    y: to.y,
    fromX: from.x - to.x,
    fromY: from.y - to.y,
    fresh: !fromRect,
    duration,
  }
  active = [...active.filter((f) => f.kind !== kind), item]
  notify()
  soundManager.play('priority', 'game')
  setTimeout(() => {
    spawnImpact('enter-ring', { left: to.x - 22, top: to.y - 22, width: 44, height: 44 })
    const badge = document.querySelector(`.player-info-bar[data-player-id="${toPlayerId}"] .${BADGE_CLASS[kind]}`)
    if (badge) {
      badge.classList.remove('badge-arrive')
      void (badge as HTMLElement).offsetWidth
      badge.classList.add('badge-arrive')
      setTimeout(() => badge.classList.remove('badge-arrive'), 700)
    }
  }, Math.round(duration * 0.85))
  setTimeout(() => {
    active = active.filter((f) => f.id !== item.id)
    notify()
  }, duration + 40)
  return item
}

/** Monarch / initiative moves between the players of two views: who got it, and from whom. */
export function passedDesignations(prev: GameView, next: GameView): Array<{ kind: PassedDesignation; from: string | null; to: string }> {
  const out: Array<{ kind: PassedDesignation; from: string | null; to: string }> = []
  for (const kind of ['monarch', 'initiative'] as const) {
    const was = (prev.players ?? []).find((p) => p[kind] === true)
    const now = (next.players ?? []).find((p) => p[kind] === true)
    if (now && now.playerId !== was?.playerId) out.push({ kind, from: was?.playerId ?? null, to: now.playerId })
  }
  return out
}
