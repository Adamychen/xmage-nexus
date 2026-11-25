import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AskBar from './AskBar'
import type { UseFeedbackForm } from '../useFeedbackForm'
import type { FeedbackPrompt } from '../feedback/types'
import { getState, initialState } from '../../state/state'
import { setState } from '../../state/state'

function stubForm(prompt: FeedbackPrompt, overrides: Partial<UseFeedbackForm> = {}): UseFeedbackForm {
  return {
    prompt,
    busy: false,
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
    sendNow: () => Promise.resolve(true),
    cancel: () => {},
    finishOptionalTarget: () => {},
    selectOption: () => {},
    confirmSelected: () => {},
    confirmAmount: () => {},
    confirmMultiAmount: () => {},
    ...overrides,
  }
}

const askPrompt: FeedbackPrompt = {
  method: 'GAME_ASK',
  gameId: 'g1',
  title: 'Confirmación',
  message: 'Pay 2 life?',
  mode: 'boolean',
  options: [
    { id: 'left', label: 'Sí', value: 'true' },
    { id: 'right', label: 'No', value: 'false' },
  ],
  min: 0,
  max: 0,
  sourceName: 'Steam Vents',
}

describe('AskBar', () => {
  afterEach(() => {
    cleanup()
    setState({ settings: { ...initialState.settings } })
  })

  it('PRM-18: the question names its source and the bar is no longer a titled box', () => {
    const { container } = render(<AskBar form={stubForm(askPrompt)} />)
    const bar = container.querySelector('.ask-prompt-bar')!
    expect(bar).toBeTruthy()
    expect(bar.classList.contains('is-keys-only')).toBe(true)
    expect(container.textContent).not.toContain('CONFIRMACIÓN')
    expect(container.querySelector('[data-testid="ask-source"]')).toBeNull()
    expect(screen.getByTestId('board-order').textContent).toContain('¿Pagar 2 vidas?')
    expect(screen.getByTestId('board-order').textContent).toContain('Steam Vents')
    expect(screen.getByRole('button', { name: /Sí/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /No/ })).toBeTruthy()
  })

  it('sends the option through selectOption and disables buttons while busy', () => {
    const selectOption = vi.fn()
    const { rerender } = render(<AskBar form={stubForm(askPrompt, { selectOption })} />)
    fireEvent.click(screen.getByRole('button', { name: /No/ }))
    expect(selectOption).toHaveBeenCalledWith(askPrompt.options[1])

    const busyOption = vi.fn()
    rerender(<AskBar form={stubForm(askPrompt, { selectOption: busyOption, busy: true })} />)
    fireEvent.click(screen.getByRole('button', { name: /Sí/ }))
    expect(busyOption).not.toHaveBeenCalled()
  })

  it('KEY-7: digit shortcuts answer the ask', () => {
    const selectOption = vi.fn()
    render(<AskBar form={stubForm(askPrompt, { selectOption })} />)
    // PRM-19: the answers are keys in the corner now, so the digits act from the bar that asks.
    fireEvent.keyDown(document.querySelector('.ask-prompt-bar')!, { key: '2' })
    expect(selectOption).toHaveBeenCalledWith(askPrompt.options[1])
  })

  it('PRM-18: the question is read across the board and the bar does not repeat it', () => {
    render(<AskBar form={stubForm(askPrompt)} />)
    expect(screen.getByTestId('board-order').textContent).toContain('¿Pagar 2 vidas?')
    expect(document.querySelector('.ask-prompt-bar .action-prompt-msg')).toBeNull()
  })

  it('PRM-18: a message too long to read across the board becomes a question about its source', () => {
    const long = { ...askPrompt, message: "At the beginning of each opponent's upkeep, you may have that player gain control of Slicer, Hired Muscle until end of turn. If you do, untap it, goad it, and it can't be sacrificed this turn." }
    render(<AskBar form={stubForm(long)} />)
    // The ability's own text is on the stack while it resolves; the board asks about it instead.
    expect(screen.getByTestId('board-order').textContent).toContain('Steam Vents')
    expect(screen.getByTestId('board-order').textContent).not.toContain('upkeep')
    expect(document.querySelector('.ask-prompt-bar')?.textContent).not.toContain('upkeep')
  })

  it('PRM-19: the first answer is the key in the corner and the second the small one above it', () => {
    const selectOption = vi.fn()
    render(<AskBar form={stubForm(askPrompt, { selectOption })} />)
    const action = screen.getByTestId('prompt-action')
    const second = screen.getByTestId('prompt-second')
    expect(action.textContent).toContain('Sí')
    expect(second.textContent).toContain('No')
    // KEY-8: each one says which digit answers it.
    expect(action.querySelector('kbd')?.textContent).toBe('1')
    expect(second.querySelector('kbd')?.textContent).toBe('2')
    fireEvent.click(action)
    expect(selectOption).toHaveBeenCalledWith(askPrompt.options[0])
  })

  it('the remember checkbox stores an auto-answer rule', () => {
    const selectOption = vi.fn()
    render(<AskBar form={stubForm(askPrompt, { selectOption })} />)
    const checkbox = screen.getByRole('checkbox', { name: /Responder siempre/ })
    fireEvent.click(checkbox)
    fireEvent.click(screen.getByRole('button', { name: /Sí/ }))
    expect(getState().settings.autoAnswers).toHaveLength(1)
    expect(getState().settings.autoAnswers[0].pattern).toBe('pay 2 life?')
    expect(getState().settings.autoAnswers[0].answer).toBe(true)
  })
})
