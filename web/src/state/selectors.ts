import { useSyncExternalStore } from 'react'
import { getState, listeners } from './state'
import type { AppState } from './state'
import type { FeedbackPrompt } from '../game/feedback'
import { handPickIds, isPlainBooleanAsk } from '../game/handPick'

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

/** Keep/mulligan decision on the opening hand (the London bottom pick is the other half of
 *  PRM-2). The hand behind the screen stays raised, so it is not dealt a second time when the
 *  screen closes. */
export function isMulliganDecision(f: FeedbackPrompt | null | undefined): boolean {
  return f?.isMulligan === true && f.isMulliganLondon !== true
}

/**
 * True when a screen-covering modal is open (and the board's hover preview
 * should be suppressed). Excludes in-board interactions like targeting bars,
 * combat and mana asks, where the floating preview must stay visible.
 */
export function isBlockingModal(s: AppState): boolean {
  if (s.userRequest) return true
  if (s.rollbackDialogOpen) return true
  if (s.rollbackVote && !s.rollbackVote.hidden) return true
  if (s.sideboardScreen) return true
  if (s.viewer) return true
  if (s.inspectedCard) return true
  if (s.draft) return true
  if (s.construct) return true
  const f = s.feedback as FeedbackPrompt | null
  if (f) {
    if (f.mode === 'mana' || f.mode === 'combat') return false
    // PRM-2: the opening hand takes the whole screen, both halves of it.
    if (isPlainBooleanAsk(f)) return false
    if (f.method === 'GAME_TARGET' && f.cards && f.cards.length > 0 && s.game) {
      const hand = new Set(Object.keys(s.game.myHand ?? {}))
      if (handPickIds(f, hand)) return false
    }
    if (f.method === 'GAME_TARGET' && (!f.cards || f.cards.length === 0)) return false
    return true
  }
  return false
}
