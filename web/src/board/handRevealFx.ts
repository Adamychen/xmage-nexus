import { useSyncExternalStore } from 'react'
import type { CardView, GameView } from '../net/types'
import { knownHandCards } from './revealedCards'
import { fxDuration, fxMotionAllowed } from './fx'
import { soundManager } from '../audio/soundManager'

/** How long a revealed hand stays fanned out, before the stagger of its cards. */
export const HAND_REVEAL_MS = 1900
/** The gap between one card of the fan turning face up and the next. */
export const HAND_REVEAL_STAGGER_MS = 90
const MAX_CARDS = 10

export interface HandReveal {
  playerId: string
  cards: CardView[]
}

/** Opponents whose hand this client sees cards of that it did not see in the previous view (the hand appeared or grew). */
export function handReveals(prevGame: GameView | null | undefined, nextGame: GameView | null | undefined): HandReveal[] {
  if (!prevGame || !nextGame) return []
  const out: HandReveal[] = []
  for (const nextP of nextGame.players ?? []) {
    if (nextP.controlled === true) continue
    const prevP = (prevGame.players ?? []).find((p) => p.playerId === nextP.playerId) ?? nextP
    const before = knownHandCards(prevGame, prevP)
    const cards = [...knownHandCards(nextGame, nextP)].filter(([id]) => !before.has(id)).map(([, card]) => card)
    if (cards.length > 0) out.push({ playerId: nextP.playerId, cards })
  }
  return out
}

export interface HandRevealFx {
  id: number
  playerId: string
  cards: CardView[]
  /** The hand the fan opens from and folds back into: the hand zone, or the portrait's hand badge. */
  x: number
  y: number
  w: number
  h: number
  /** The fan opens below its hand (an opponent seated at the top) or above it. */
  below: boolean
  duration: number
  stagger: number
}

let reveals: HandRevealFx[] = []
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

export function getHandReveals(): HandRevealFx[] {
  return reveals
}

export function useHandReveals(): HandRevealFx[] {
  return useSyncExternalStore(subscribe, getHandReveals, getHandReveals)
}

export function clearHandReveals(): void {
  reveals = []
  notify()
}

/** A revealed hand fans out face up from where it is drawn, card by card, then folds back into it. */
export function spawnHandReveal(playerId: string, cards: CardView[], anchor: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'> | null): HandRevealFx | null {
  if (!anchor || cards.length === 0 || !fxMotionAllowed()) return null
  const shown = cards.slice(0, MAX_CARDS)
  const stagger = fxDuration(HAND_REVEAL_STAGGER_MS)
  const duration = fxDuration(HAND_REVEAL_MS) + stagger * (shown.length - 1)
  if (!duration) return null
  const viewH = typeof window !== 'undefined' ? window.innerHeight : 800
  const item: HandRevealFx = {
    id: ++counter,
    playerId,
    cards: shown,
    x: anchor.left + anchor.width / 2,
    y: anchor.top + anchor.height / 2,
    w: anchor.width,
    h: anchor.height,
    below: anchor.top + anchor.height / 2 < viewH / 2,
    duration,
    stagger,
  }
  reveals = [...reveals.filter((r) => r.playerId !== playerId), item]
  notify()
  soundManager.play('draw', 'game')
  setTimeout(() => {
    reveals = reveals.filter((r) => r.id !== item.id)
    notify()
  }, duration + 60)
  return item
}
