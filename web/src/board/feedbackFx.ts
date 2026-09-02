import { useSyncExternalStore } from 'react'
import { fxDuration } from './fx'

export type FeedbackTone = 'bad' | 'good' | 'poison'

export interface FloaterFx {
  id: number
  text: string
  x: number
  y: number
  tone: FeedbackTone
  duration: number
}

export interface BannerFx {
  id: number
  text: string
  sub?: string
  duration: number
}

export interface FeedbackFxState {
  floaters: FloaterFx[]
  banner: BannerFx | null
}

let state: FeedbackFxState = { floaters: [], banner: null }
let counter = 0
const listeners = new Set<() => void>()
const lastSpawnAt = new Map<string, number>()

function notify() {
  listeners.forEach((fn) => fn())
}

function getSnapshot(): FeedbackFxState {
  return state
}

export function subscribeFeedback(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function getFeedbackFxState(): FeedbackFxState {
  return state
}

export function useFeedbackFx(): FeedbackFxState {
  return useSyncExternalStore(subscribeFeedback, getSnapshot, getSnapshot)
}

export function clearFeedbackFx() {
  lastSpawnAt.clear()
  state = { floaters: [], banner: null }
  notify()
}

const MIN_INTERVAL_MS = 180
const MAX_FLOATERS = 14

/** Número flotante (daño/vida/veneno) sobre el rect de un elemento. Con
 *  throttle por clave para no amontonar números en actualizaciones rápidas. */
export function spawnFloater(
  dedupeKey: string,
  rect: DOMRect | null,
  text: string,
  tone: FeedbackTone
): void {
  const duration = fxDuration(1150)
  if (!duration || !rect || rect.width <= 0 || rect.height <= 0) return
  const now = Date.now()
  if (now - (lastSpawnAt.get(dedupeKey) ?? 0) < MIN_INTERVAL_MS) return
  lastSpawnAt.set(dedupeKey, now)

  const item: FloaterFx = {
    id: ++counter,
    text,
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height * 0.18,
    tone,
    duration,
  }
  state = { ...state, floaters: [...state.floaters, item].slice(-MAX_FLOATERS) }
  notify()
  setTimeout(() => {
    state = { ...state, floaters: state.floaters.filter((f) => f.id !== item.id) }
    notify()
  }, duration + 60)
}

/** Banner centrado (anuncio de turno) con auto-cierre. */
export function announceBanner(text: string, sub?: string): void {
  const duration = fxDuration(1900)
  if (!duration) return
  const item: BannerFx = { id: ++counter, text, sub, duration }
  state = { ...state, banner: item }
  notify()
  setTimeout(() => {
    if (state.banner?.id === item.id) {
      state = { ...state, banner: null }
      notify()
    }
  }, duration)
}
