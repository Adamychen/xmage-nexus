import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useFeedbackForm } from './useFeedbackForm'
import { getState, setState } from '../state/state'
import type { FeedbackPrompt } from './feedback'

let resolveSend: ((r: { ok: boolean }) => void) | null = null

vi.mock('../net/commands', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../net/commands')>()),
  sendPlayerBoolean: vi.fn(() => new Promise((resolve) => { resolveSend = resolve })),
}))

const prompt = (message: string): FeedbackPrompt =>
  ({ method: 'GAME_ASK', gameId: 'g1', mode: 'boolean', message, options: [{ id: 'no', label: 'No', value: 'false' }], min: 0, max: 1 } as unknown as FeedbackPrompt)

describe('useFeedbackForm', () => {
  afterEach(() => {
    cleanup()
    setState({ feedback: null })
    resolveSend = null
  })

  it('clears the answered prompt once the server acknowledges it', async () => {
    const first = prompt('first?')
    setState({ feedback: first })
    const { result } = renderHook(() => useFeedbackForm())
    act(() => result.current.selectOption(first.options[0]))
    await act(async () => resolveSend?.({ ok: true }))
    expect(getState().feedback).toBeNull()
  })

  it('keeps a newer prompt that arrived before the acknowledgement', async () => {
    const first = prompt('first?')
    setState({ feedback: first })
    const { result } = renderHook(() => useFeedbackForm())
    act(() => result.current.selectOption(first.options[0]))
    const next = prompt('next?')
    act(() => setState({ feedback: next }))
    await act(async () => resolveSend?.({ ok: true }))
    expect(getState().feedback).toBe(next)
  })
})
