import { beforeEach, describe, expect, it, vi } from 'vitest'
import { soundManager } from './soundManager'
import { feedbackSignature, notifyFeedbackOpened, resetPromptSound } from './promptSound'
import { handleMessage, clearFeedback } from '../state/store'
import type { FeedbackPrompt } from '../game/feedback/types'

const ALL_KEYS_CHECK = 'prompt_open' as const

function makePrompt(overrides: Partial<FeedbackPrompt> = {}): FeedbackPrompt {
  return {
    method: 'GAME_ASK',
    gameId: 'g1',
    title: 'Pregunta',
    message: 'Keep your hand or mulligan?',
    mode: 'boolean',
    options: [
      { id: 'keep', label: 'Keep hand', value: 'false' },
      { id: 'mulligan', label: 'Mulligan', value: 'true' },
    ],
    min: 1,
    max: 1,
    ...overrides,
  }
}

describe('promptSound', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(soundManager, 'play').mockImplementation(() => {})
    resetPromptSound()
    clearFeedback()
  })

  it('exposes prompt_open as a sound key', () => {
    expect(ALL_KEYS_CHECK).toBe('prompt_open')
  })

  it('sounds once per feedback signature', () => {
    notifyFeedbackOpened(makePrompt())
    notifyFeedbackOpened(makePrompt())
    expect(soundManager.play).toHaveBeenCalledTimes(1)
    expect(soundManager.play).toHaveBeenCalledWith('prompt_open', 'ui')
  })

  it('sounds again when the prompt changes', () => {
    notifyFeedbackOpened(makePrompt())
    notifyFeedbackOpened(makePrompt({ message: 'Pay {2}?' }))
    expect(soundManager.play).toHaveBeenCalledTimes(2)
  })

  it('distinguishes signatures by options', () => {
    expect(feedbackSignature(makePrompt())).not.toBe(
      feedbackSignature(makePrompt({ options: [{ id: 'yes', label: 'Yes', value: 'true' }] }))
    )
  })

  it('sounds again after the prompt is answered', () => {
    notifyFeedbackOpened(makePrompt())
    clearFeedback()
    notifyFeedbackOpened(makePrompt())
    expect(soundManager.play).toHaveBeenCalledTimes(2)
  })

  it('sounds when a GAME_ASK prompt opens via handleMessage', () => {
    handleMessage({
      type: 'event',
      method: 'GAME_ASK',
      messageId: 70,
      objectId: 'g1',
      data: {
        message: 'Do you want to pay {2}?',
        options: ['Yes', 'No'],
      },
    } as never)
    expect(soundManager.play).toHaveBeenCalledWith('prompt_open', 'ui')
  })

  it('does not replay when the same GAME_ASK arrives twice', () => {
    const msg = {
      type: 'event',
      method: 'GAME_ASK',
      messageId: 71,
      objectId: 'g1',
      data: {
        message: 'Do you want to pay {2}?',
        options: ['Yes', 'No'],
      },
    } as never
    handleMessage(msg)
    handleMessage(msg)
    const calls = (soundManager.play as unknown as { mock: { calls: unknown[][] } }).mock.calls.filter(
      ([key]) => key === 'prompt_open'
    )
    expect(calls).toHaveLength(1)
  })
})
