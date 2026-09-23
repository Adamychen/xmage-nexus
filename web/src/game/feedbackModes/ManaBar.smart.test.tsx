// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ManaBar from './ManaBar'
import { setSetting, setState } from '../../state/store'
import { DEFAULT_MANA_PAYMENT } from '../../state/persistence'
import { makeGameView, makePermanent, makePlayer } from '../../__fixtures__/gameViews'
import type { UseFeedbackForm } from '../useFeedbackForm'
import type { FeedbackPrompt } from '../feedback/types'

const sendPlayerUUID = vi.fn()
const sendPlayerManaType = vi.fn()

vi.mock('../../net/commands', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../net/commands')>()),
  sendPlayerUUID: (...args: unknown[]) => sendPlayerUUID(...args),
  sendPlayerManaType: (...args: unknown[]) => sendPlayerManaType(...args),
}))

const forest = () => makePermanent({ name: 'Forest', cardTypes: ['LAND'], rules: ['{T}: Add {G}.'] })

function gameWith(battlefield: Record<string, ReturnType<typeof forest>>) {
  return makeGameView({
    players: [makePlayer({ playerId: 'p1', name: 'Me', controlled: true, battlefield })],
    myPlayerId: 'p1',
  })
}

function prompt(message: string): FeedbackPrompt {
  return { method: 'GAME_PLAY_MANA', gameId: 'g1', title: 'Pay', message, mode: 'mana', options: [], min: 0, max: 0, playerId: 'p1' }
}

function form(p: FeedbackPrompt, busy = false): UseFeedbackForm {
  return {
    prompt: p,
    busy,
    amount: 0,
    setAmount: () => {},
    selected: [],
    setSelected: () => {},
    multiAmounts: {},
    setMultiAmounts: () => {},
    textValue: '',
    setTextValue: () => {},
    filteredStringOptions: [],
    send: () => Promise.resolve(),
    cancel: () => {},
    finishOptionalTarget: () => {},
    selectOption: () => {},
    confirmSelected: () => {},
    confirmAmount: () => {},
    confirmMultiAmount: () => {},
  }
}

describe('ManaBar smart mana payment', () => {
  beforeEach(() => {
    sendPlayerUUID.mockReset().mockResolvedValue({ ok: true })
    sendPlayerManaType.mockReset().mockResolvedValue({ ok: true })
    setState({ game: gameWith({ f1: forest(), f2: forest() }) as never })
    setSetting('manaPayment', { ...DEFAULT_MANA_PAYMENT, smart: true })
  })

  afterEach(() => {
    cleanup()
    setState({ game: null })
    setSetting('manaPayment', { ...DEFAULT_MANA_PAYMENT })
  })

  it('taps one source for a solvable prompt when the toggle is on', async () => {
    render(<ManaBar form={form(prompt('Pay {G}{1}'))} />)
    await waitFor(() => expect(sendPlayerUUID).toHaveBeenCalledTimes(1))
    expect(['f1', 'f2']).toContain(sendPlayerUUID.mock.calls[0][0])
    expect(sendPlayerUUID.mock.calls[0][1]).toBe('g1')
  })

  it('does nothing while the toggle is off (default)', async () => {
    setSetting('manaPayment', { ...DEFAULT_MANA_PAYMENT, smart: false })
    render(<ManaBar form={form(prompt('Pay {G}{1}'))} />)
    await new Promise((r) => setTimeout(r, 20))
    expect(sendPlayerUUID).not.toHaveBeenCalled()
  })

  it('does nothing while the prompt form is busy', async () => {
    render(<ManaBar form={form(prompt('Pay {G}{1}'), true)} />)
    await new Promise((r) => setTimeout(r, 20))
    expect(sendPlayerUUID).not.toHaveBeenCalled()
  })

  it('does nothing when the cost cannot be paid from known sources', async () => {
    render(<ManaBar form={form(prompt('Pay {R}'))} />)
    await new Promise((r) => setTimeout(r, 20))
    expect(sendPlayerUUID).not.toHaveBeenCalled()
  })

  it('continues on the follow-up prompt when the cost dropped by exactly one', async () => {
    const view = render(<ManaBar form={form(prompt('Pay {G}{1}'))} />)
    await waitFor(() => expect(sendPlayerUUID).toHaveBeenCalledTimes(1))
    view.rerender(<ManaBar form={form(prompt('Pay {1}'))} />)
    await waitFor(() => expect(sendPlayerUUID).toHaveBeenCalledTimes(2))
  })

  it('stops for the rest of the payment when the follow-up cost is not what it expected', async () => {
    const view = render(<ManaBar form={form(prompt('Pay {G}{1}'))} />)
    await waitFor(() => expect(sendPlayerUUID).toHaveBeenCalledTimes(1))
    view.rerender(<ManaBar form={form(prompt('Pay {G}{1}'))} />)
    view.rerender(<ManaBar form={form(prompt('Pay {1}'))} />)
    await new Promise((r) => setTimeout(r, 20))
    expect(sendPlayerUUID).toHaveBeenCalledTimes(1)
  })
})
