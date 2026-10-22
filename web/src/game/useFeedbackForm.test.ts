import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import * as cmds from '../net/commands'
import { useFeedbackForm } from './useFeedbackForm'
import { getState, setState } from '../state/state'
import type { FeedbackPrompt } from './feedback'

let resolveSend: ((r: { ok: boolean }) => void) | null = null

vi.mock('../net/commands', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../net/commands')>()),
  sendPlayerBoolean: vi.fn(() => new Promise((resolve) => { resolveSend = resolve })),
  sendPlayerInteger: vi.fn(async () => ({ ok: true })),
  sendPlayerUUID: vi.fn(async () => ({ ok: true })),
}))

const prompt = (message: string): FeedbackPrompt =>
  ({ method: 'GAME_ASK', gameId: 'g1', mode: 'boolean', message, options: [{ id: 'no', label: 'No', value: 'false' }], min: 0, max: 1 } as unknown as FeedbackPrompt)

describe('useFeedbackForm', () => {
  afterEach(() => {
    cleanup()
    setState({ feedback: null })
    resolveSend = null
  })

  it('PRM-9: clears the answered prompt once the server acknowledges it', async () => {
    const first = prompt('first?')
    setState({ feedback: first })
    const { result } = renderHook(() => useFeedbackForm())
    act(() => result.current.selectOption(first.options[0]))
    await act(async () => resolveSend?.({ ok: true }))
    expect(getState().feedback).toBeNull()
  })

  it('PRM-9: keeps a newer prompt that arrived before the acknowledgement', async () => {
    const first = prompt('first?')
    setState({ feedback: first })
    const { result } = renderHook(() => useFeedbackForm())
    act(() => result.current.selectOption(first.options[0]))
    const next = prompt('next?')
    act(() => setState({ feedback: next }))
    await act(async () => resolveSend?.({ ok: true }))
    expect(getState().feedback).toBe(next)
  })
  it('does not send an amount outside the prompt range', () => {
    const amount = { ...prompt('how many?'), method: 'GAME_GET_AMOUNT', mode: 'integer', min: 0, max: 5, options: [] } as unknown as FeedbackPrompt
    setState({ feedback: amount })
    const { result } = renderHook(() => useFeedbackForm())
    act(() => result.current.setAmount(7))
    act(() => result.current.confirmAmount())
    act(() => result.current.setAmount(Number.NaN))
    act(() => result.current.confirmAmount())
    expect(cmds.sendPlayerInteger).not.toHaveBeenCalled()
    expect(getState().feedback).toBe(amount)
  })

  it('does not clear a multi-select prompt when confirmed with nothing selected', async () => {
    const multi = { ...prompt('pick?'), method: 'GAME_SELECT_CARDS', mode: 'uuid', max: 2, options: [{ id: 'a', label: 'A', value: 'a' }] } as unknown as FeedbackPrompt
    setState({ feedback: multi })
    const { result } = renderHook(() => useFeedbackForm())
    act(() => result.current.confirmSelected())
    await act(async () => {})
    expect(cmds.sendPlayerUUID).not.toHaveBeenCalled()
    expect(getState().feedback).toBe(multi)
  })
})
