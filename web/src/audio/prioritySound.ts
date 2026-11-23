import { soundManager } from './soundManager'

/**
 * When the priority cue sounds. The server emits one `GAME_SELECT` per phase,
 * so the previous behaviour (cue on every `GAME_SELECT`) played on every phase
 * change even when nothing had happened.
 *
 * `every-prompt` and `on-gain` read the view diff (`gameSoundDispatcher.ts`).
 * `on-stop` does not: the cue belongs to the client's own stop decision
 * (`maybeAutoPass`), which runs a frame later and knows the windows it passes
 * by itself.
 */
export type PrioritySoundMode = 'every-prompt' | 'on-gain' | 'on-stop' | 'off'

export const PRIORITY_SOUND_MODES: readonly PrioritySoundMode[] = ['every-prompt', 'on-gain', 'on-stop', 'off']

export function normalizePrioritySound(value: unknown): PrioritySoundMode {
  return PRIORITY_SOUND_MODES.includes(value as PrioritySoundMode) ? (value as PrioritySoundMode) : 'every-prompt'
}

/**
 * The mode as it actually behaves. With smart stops off the client passes
 * nothing, so `on-stop` has no decision to hang the cue on and falls back to
 * `on-gain`, the nearest mode that still sounds once per window.
 */
export function effectivePrioritySound(mode: PrioritySoundMode, smartStops: boolean): PrioritySoundMode {
  return mode === 'on-stop' && !smartStops ? 'on-gain' : mode
}

/** Why the client keeps a priority window instead of passing it (`maybeAutoPass`). */
export type PriorityStopReason = 'prompt' | 'rollback-vote' | 'controlled-priority' | 'combat' | 'phase-stop'

/**
 * The cue for a window the client decided to keep. Only `on-stop` plays it, and
 * never for a `prompt`: the dialog that opened already sounded (`prompt_open`,
 * `promptSound.ts`) and the two cues would land a frame apart on the same event.
 */
export function playPriorityStopCue(mode: PrioritySoundMode, smartStops: boolean, reason: PriorityStopReason): void {
  if (effectivePrioritySound(mode, smartStops) !== 'on-stop') return
  if (reason === 'prompt') return
  soundManager.play('priority', 'game')
}
