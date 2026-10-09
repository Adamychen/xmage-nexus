/**
 * When the priority cue sounds. The server emits one `GAME_SELECT` per phase,
 * so the previous behaviour (cue on every `GAME_SELECT`) played on every phase
 * change even when nothing had happened.
 */
export type PrioritySoundMode = 'every-prompt' | 'on-gain' | 'off'

export const PRIORITY_SOUND_MODES: readonly PrioritySoundMode[] = ['every-prompt', 'on-gain', 'off']

export function normalizePrioritySound(value: unknown): PrioritySoundMode {
  return PRIORITY_SOUND_MODES.includes(value as PrioritySoundMode) ? (value as PrioritySoundMode) : 'every-prompt'
}