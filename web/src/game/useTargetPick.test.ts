import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import * as cmds from '../net/commands'
import { useTargetPick } from './useTargetPick'
import { getState, setState } from '../state/state'
import type { FeedbackPrompt } from './feedback'

const pending: ((r: { ok: boolean; error?: string }) => void)[] = []

vi.mock('../net/commands', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../net/commands')>()),
  sendPlayerUUID: vi.fn(() => new Promise((resolve) => { pending.push(resolve) })),
}))

const discard = (chosen: string[]): FeedbackPrompt =>
  ({
    method: 'GAME_TARGET',
    gameId: 'g1',
    mode: 'uuid',
    message: 'Select a card to discard',
    options: ['a', 'b', 'c'].map((id) => ({ id, label: id, value: id })),
    chosenTargets: chosen,
    min: 2,
    max: 2,
  } as unknown as FeedbackPrompt)

describe('useTargetPick', () => {
  afterEach(() => {
    cleanup()
    setState({ feedback: null })
    pending.length = 0
    vi.mocked(cmds.sendPlayerUUID).mockClear()
  })

  it('PRM-17: a second pick on a prompt already answered is not sent', async () => {
    setState({ feedback: discard([]) })
    const { result } = renderHook(() => useTargetPick('g1', () => {}))
    await act(async () => { void result.current('a') })
    await act(async () => { void result.current('b') })
    expect(cmds.sendPlayerUUID).toHaveBeenCalledTimes(1)
    expect(cmds.sendPlayerUUID).toHaveBeenCalledWith('a', 'g1')
  })

  it('PRM-17: the last discard pick closes the prompt the server sent after the first one', async () => {
    setState({ feedback: discard([]) })
    const { result } = renderHook(() => useTargetPick('g1', () => {}))
    await act(async () => { void result.current('a') })
    await act(async () => { void result.current('b') })
    const next = discard(['a'])
    setState({ feedback: next })
    await act(async () => pending.shift()?.({ ok: true }))
    expect(getState().feedback).toBe(next)
    await act(async () => { void result.current('b') })
    await act(async () => pending.shift()?.({ ok: true }))
    expect(cmds.sendPlayerUUID).toHaveBeenCalledTimes(2)
    expect(getState().feedback).toBeNull()
  })

  it('PRM-17: a rejected pick can be sent again on the same prompt', async () => {
    setState({ feedback: discard([]) })
    const onError = vi.fn()
    const { result } = renderHook(() => useTargetPick('g1', onError))
    await act(async () => { void result.current('a') })
    await act(async () => pending.shift()?.({ ok: false, error: 'nope' }))
    expect(onError).toHaveBeenCalledWith('nope')
    await act(async () => { void result.current('a') })
    expect(cmds.sendPlayerUUID).toHaveBeenCalledTimes(2)
  })
})
