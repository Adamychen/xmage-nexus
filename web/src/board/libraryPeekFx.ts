import { useSyncExternalStore } from 'react'
import { getState } from '../state/state'
import { soundManager } from '../audio/soundManager'
import { fxMotionDuration } from './fx'
import { CHIP_DECK_H, CHIP_DECK_W, chipDeckCentre, libraryElement } from './shuffleFx'

export interface LibraryPeekFx {
  id: number
  playerId: string
  mine: boolean
  count: number
  up: boolean
  deckX: number
  deckY: number
  w: number
  h: number
  duration: number
}

export const PEEK_MAX_CARDS = 5

let active: LibraryPeekFx[] = []
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

export function getLibraryPeeks(): LibraryPeekFx[] {
  return active
}

export function useLibraryPeeks(): LibraryPeekFx[] {
  return useSyncExternalStore(subscribe, getLibraryPeeks, getLibraryPeeks)
}

export function clearLibraryPeeks(): void {
  active = []
  notify()
}

/** Scry / surveil: the top cards of `playerId`'s library lift in their sleeve, fan out, hold and settle back; nothing when effects are off, under reduced motion or with no visible library. */
export function spawnLibraryPeek(playerId: string, amount: number): LibraryPeekFx | null {
  if (typeof document === 'undefined') return null
  const count = Math.min(Math.max(Math.floor(amount), 0), PEEK_MAX_CARDS)
  if (count === 0) return null
  const found = libraryElement(playerId)
  if (!found) return null
  const duration = fxMotionDuration(1300)
  if (!duration) return null
  const r = found.el.getBoundingClientRect()
  const chip = found.mode === 'chip'
  const deck = chip ? chipDeckCentre(found.el, r) : { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  const me = getState().game?.players?.find((p) => p.controlled)
  const item: LibraryPeekFx = {
    id: ++counter,
    playerId,
    mine: me?.playerId === playerId,
    count,
    up: r.top + r.height / 2 > window.innerHeight / 2,
    deckX: deck.x,
    deckY: deck.y,
    w: chip ? CHIP_DECK_W : r.width,
    h: chip ? CHIP_DECK_H : r.height,
    duration,
  }
  active = [...active.filter((f) => f.playerId !== playerId), item]
  notify()
  soundManager.play('draw', 'game')
  setTimeout(() => {
    active = active.filter((f) => f.id !== item.id)
    notify()
  }, duration + 40)
  return item
}
