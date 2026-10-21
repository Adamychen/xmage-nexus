import { useSyncExternalStore } from 'react'
import { cleanMageText } from '../game/gameEventParser'
import { getState } from '../state/state'
import { soundManager } from '../audio/soundManager'
import { fxMotionDuration } from './fx'

/** `pile`: the library is drawn as a stack of card backs (classic table). `chip`: it is an icon and a count (new table, pod, arena). */
export type ShuffleMode = 'pile' | 'chip'

export interface ShuffleFx {
  id: number
  playerId: string
  mine: boolean
  mode: ShuffleMode
  x: number
  y: number
  w: number
  h: number
  /** Where the riffling deck is drawn: centre point; on a pile it is the pile itself. */
  deckX: number
  deckY: number
  duration: number
}

export const CHIP_DECK_W = 42
export const CHIP_DECK_H = 59
const CHIP_DECK_GAP = 10

const BASE_MS: Record<ShuffleMode, number> = { pile: 650, chip: 1000 }
const REPEAT_GAP_MS = 400

/**
 * The server announces every shuffle only as game-log text (`PlayerImpl.shuffleLibrary`:
 * "<name>'s library is shuffled (source: …)", `shuffleCardsToLibrary`: "<name> shuffles two
 * cards into their library"); a shuffle changes nothing in the `GameView`.
 */
const SHUFFLED_RE = /^(.+?)'s library is shuffled\b/i
const SHUFFLED_INTO_RE = /^(.+?) shuffles \S+ cards? into (?:their|his|her|its) library\b/i

export function parseShuffle(message: string): { player: string } | null {
  const text = cleanMageText(message)
  const m = text.match(SHUFFLED_RE) ?? text.match(SHUFFLED_INTO_RE)
  const player = m?.[1]?.trim()
  return player ? { player } : null
}

let active: ShuffleFx[] = []
let counter = 0
const lastAt = new Map<string, number>()
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

export function getShuffles(): ShuffleFx[] {
  return active
}

export function useShuffles(): ShuffleFx[] {
  return useSyncExternalStore(subscribe, getShuffles, getShuffles)
}

export function clearShuffles(): void {
  active = []
  lastAt.clear()
  notify()
}

export function libraryElement(playerId: string): { el: HTMLElement; mode: ShuffleMode } | null {
  const els = [...document.querySelectorAll<HTMLElement>(`[data-player-id="${playerId}"] :is(.library-stack, .library-chip)`)]
  const el = els.find((e) => {
    const r = e.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  })
  if (!el) return null
  return { el, mode: el.classList.contains('library-stack') ? 'pile' : 'chip' }
}

/**
 * A chip is too small to riffle on, and it sits inside the player's portrait: the deck pops out
 * past the portrait, towards the board (above a portrait in the bottom half, below one at the top).
 */
export function chipDeckCentre(el: HTMLElement, chip: DOMRect): { x: number; y: number } {
  const bar = (el.closest('.player-info-bar') as HTMLElement | null)?.getBoundingClientRect() ?? chip
  const x = chip.left + chip.width / 2
  const below = chip.top + chip.height / 2 < window.innerHeight / 2
  return below
    ? { x, y: bar.bottom + CHIP_DECK_GAP + CHIP_DECK_H / 2 }
    : { x, y: bar.top - CHIP_DECK_GAP - CHIP_DECK_H / 2 }
}

/** Riffles the library of `playerId` where it is drawn; nothing when effects are off, under reduced motion or with no visible library. */
export function spawnShuffle(playerId: string): ShuffleFx | null {
  if (typeof document === 'undefined') return null
  const now = Date.now()
  if (now - (lastAt.get(playerId) ?? 0) < REPEAT_GAP_MS) return null
  const found = libraryElement(playerId)
  if (!found) return null
  const duration = fxMotionDuration(BASE_MS[found.mode])
  if (!duration) return null
  lastAt.set(playerId, now)
  const r = found.el.getBoundingClientRect()
  const deck = found.mode === 'pile' ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : chipDeckCentre(found.el, r)
  const me = getState().game?.players?.find((p) => p.controlled)
  const item: ShuffleFx = {
    id: ++counter,
    playerId,
    mine: me?.playerId === playerId,
    mode: found.mode,
    x: r.left,
    y: r.top,
    w: r.width,
    h: r.height,
    deckX: deck.x,
    deckY: deck.y,
    duration,
  }
  active = [...active.filter((f) => f.playerId !== playerId), item]
  notify()
  if (found.mode === 'pile') {
    found.el.classList.add('is-shuffling')
    setTimeout(() => found.el.classList.remove('is-shuffling'), duration)
  }
  soundManager.play('shuffle', 'game')
  setTimeout(() => {
    active = active.filter((f) => f.id !== item.id)
    notify()
  }, duration + 40)
  return item
}

/** Game-log hook: a shuffle line for a player of the current game riffles that player's library. */
export function sniffShuffle(message: string, gameId: string | null | undefined): void {
  if (!gameId) return
  const hit = parseShuffle(message)
  if (!hit) return
  const s = getState()
  if (s.gameId !== gameId) return
  const named = hit.player.toLowerCase()
  const player = s.game?.players?.find((p) => p.name.trim().toLowerCase() === named)
  if (player) spawnShuffle(player.playerId)
}
