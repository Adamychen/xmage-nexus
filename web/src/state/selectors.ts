import { useSyncExternalStore } from 'react'
import { getState, listeners } from './state'
import type { AppState } from './state'
import type { FeedbackPrompt } from '../game/feedback'

export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => selector(getState()),
  )
}

export function usePhase() {
  return useStore((s) => s.phase)
}

export function useLobby() {
  return useStore((s) => s.lobby)
}

export function useGame() {
  return useStore((s) => s.game)
}

export function useSettings() {
  return useStore((s) => s.settings)
}

/**
 * True when a screen-covering modal is open (and the board's hover preview
 * should be suppressed). Excludes in-board interactions like targeting bars,
 * combat and mana asks, where the floating preview must stay visible.
 */
export function isBlockingModal(s: AppState): boolean {
  if (s.userRequest) return true
  if (s.rollbackDialogOpen) return true
  if (s.sideboardScreen) return true
  if (s.viewer) return true
  if (s.draft) return true
  if (s.construct) return true
  const f = s.feedback as FeedbackPrompt | null
  if (f) {
    if (f.mode === 'mana' || f.mode === 'combat') return false
    if (f.method === 'GAME_TARGET' && (!f.cards || f.cards.length === 0)) return false
    return true
  }
  return false
}
