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

  it('shows kicker, source, message and the yes/no buttons in a non-modal bar', () => {
    const { container } = render(<AskBar form={stubForm(askPrompt)} />)
    const bar = container.querySelector('.ask-prompt-bar')!
    expect(bar).toBeTruthy()
    expect(bar.classList.contains('feedback-dialog')).toBe(true)
    expect(bar.getAttribute('role')).toBe('group')
    expect(container.textContent).toContain('CONFIRMACIÓN')
    expect(screen.getByTestId('ask-source').textContent).toContain('Steam Vents')
    expect(screen.getByText('¿Pagar 2 vidas?')).toBeTruthy()
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

  it('digit shortcuts answer the ask', () => {
    const selectOption = vi.fn()
    render(<AskBar form={stubForm(askPrompt, { selectOption })} />)
    fireEvent.keyDown(document.querySelector('.feedback-options-grid')!, { key: '2' })
    expect(selectOption).toHaveBeenCalledWith(askPrompt.options[1])
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
