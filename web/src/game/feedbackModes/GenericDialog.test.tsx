import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import GenericDialog from './GenericDialog'
import type { UseFeedbackForm } from '../useFeedbackForm'
import type { FeedbackPrompt } from '../feedback/types'

function stubForm(prompt: FeedbackPrompt | null): UseFeedbackForm {
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
  }
}

const booleanPrompt: FeedbackPrompt = {
  method: 'GAME_ASK',
  gameId: 'g1',
  title: 'Test',
  message: 'Pay?',
  mode: 'boolean',
  options: [
    { id: 'yes', label: 'Yes', value: 'true' },
    { id: 'no', label: 'No', value: 'false' },
  ],
  min: 0,
  max: 1,
}

describe('GenericDialog hooks', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('grid: roving tabindex with arrow navigation, Enter and digit shortcuts (1-9)', () => {
    const options = [
      { id: 'o1', label: 'Alpha', value: 'a' },
      { id: 'o2', label: 'Beta', value: 'b' },
      { id: 'o3', label: 'Gamma', value: 'c' },
    ]
    const selectOption = vi.fn()
    const gridPrompt: FeedbackPrompt = {
      method: 'GAME_CHOOSE_MODE',
      gameId: 'g1',
      title: 'Choose',
      message: 'Pick one',
      mode: 'uuid',
      options,
      min: 0,
      max: 1,
      required: true,
    }
    const { container } = render(<GenericDialog form={{ ...stubForm(gridPrompt), selectOption }} />)
    const grid = container.querySelector('.feedback-options-grid') as HTMLElement
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('.feedback-choice-card'))
    expect(buttons.length).toBe(3)
    expect(buttons[0].tabIndex).toBe(0)
    expect(buttons[1].tabIndex).toBe(-1)

    fireEvent.keyDown(grid, { key: 'ArrowDown' })
    expect(container.querySelectorAll<HTMLButtonElement>('.feedback-choice-card')[1].tabIndex).toBe(0)

    fireEvent.keyDown(grid, { key: 'Enter' })
    expect(selectOption).toHaveBeenCalledWith(options[1])

    fireEvent.keyDown(grid, { key: '3' })
    expect(selectOption).toHaveBeenCalledWith(options[2])
  })

  it('multi-amount: live value plus row-context labels on the steppers', () => {
    const multiPrompt: FeedbackPrompt = {
      method: 'GAME_GET_MULTI_AMOUNT',
      gameId: 'g1',
      title: 'Split',
      message: 'Split the damage',
      mode: 'multiString',
      options: [],
      min: 0,
      max: 5,
      items: [{ id: 'm1', label: 'Ritos', min: 0, max: 5, defaultValue: 2 }],
    }
    const { container } = render(<GenericDialog form={stubForm(multiPrompt)} />)
    const val = container.querySelector('.multi-stepper-val')!
    expect(val.getAttribute('role')).toBe('status')
    expect(val.getAttribute('aria-live')).toBe('polite')
    expect(val.getAttribute('aria-label')).toContain('Ritos')
    const steppers = Array.from(container.querySelectorAll('.multi-stepper .stepper-btn'))
    expect(steppers.length).toBe(2)
    for (const btn of steppers) {
      expect(btn.getAttribute('aria-label')).toContain('Ritos')
    }
  })

  it('string mode: no Cancelar button when the prompt is required (default)', () => {
    const stringPrompt: FeedbackPrompt = {
      method: 'GAME_CHOOSE_CHOICE',
      gameId: 'g1',
      title: 'Name a card',
      message: 'Name a card',
      mode: 'string',
      options: [],
      min: 0,
      max: 1,
    }
    const { container } = render(<GenericDialog form={stubForm(stringPrompt)} />)
    expect(container.querySelector('.cancel-btn')).toBeNull()
  })

  it('string mode: shows a functional Cancelar button when the prompt declares itself optional', () => {
    const cancel = vi.fn()
    const stringPrompt: FeedbackPrompt = {
      method: 'GAME_CHOOSE_CHOICE',
      gameId: 'g1',
      title: 'Name a card',
      message: 'Name a card',
      mode: 'string',
      options: [],
      min: 0,
      max: 1,
      required: false,
    }
    const { container } = render(<GenericDialog form={{ ...stubForm(stringPrompt), cancel }} />)
    const btn = container.querySelector<HTMLButtonElement>('.cancel-btn')
    expect(btn).not.toBeNull()
    fireEvent.click(btn!)
    expect(cancel).toHaveBeenCalled()
  })

  it('integer mode: no Cancelar button when the prompt is required (default)', () => {
    const amountPrompt: FeedbackPrompt = {
      method: 'GAME_GET_AMOUNT',
      gameId: 'g1',
      title: 'Amount',
      message: 'Choose an amount',
      mode: 'integer',
      options: [],
      min: 0,
      max: 5,
    }
    const { container } = render(<GenericDialog form={stubForm(amountPrompt)} />)
    expect(container.querySelector('.cancel-btn')).toBeNull()
  })

  it('integer mode: shows Cancelar when the prompt declares itself optional', () => {
    const amountPrompt: FeedbackPrompt = {
      method: 'GAME_GET_AMOUNT',
      gameId: 'g1',
      title: 'Amount',
      message: 'Choose an amount',
      mode: 'integer',
      options: [],
      min: 0,
      max: 5,
      required: false,
    }
    const { container } = render(<GenericDialog form={stubForm(amountPrompt)} />)
    expect(container.querySelector('.cancel-btn')).not.toBeNull()
  })

  it('multiString mode: no Cancelar button when the prompt is required (default)', () => {
    const multiPrompt: FeedbackPrompt = {
      method: 'GAME_GET_MULTI_AMOUNT',
      gameId: 'g1',
      title: 'Split',
      message: 'Split the damage',
      mode: 'multiString',
      options: [],
      min: 0,
      max: 5,
      items: [{ id: 'm1', label: 'Ritos', min: 0, max: 5, defaultValue: 2 }],
    }
    const { container } = render(<GenericDialog form={stubForm(multiPrompt)} />)
    expect(container.querySelector('.cancel-btn')).toBeNull()
  })

  it('multiString mode: shows Cancelar when the prompt declares itself optional', () => {
    const multiPrompt: FeedbackPrompt = {
      method: 'GAME_GET_MULTI_AMOUNT',
      gameId: 'g1',
      title: 'Split',
      message: 'Split the damage',
      mode: 'multiString',
      options: [],
      min: 0,
      max: 5,
      items: [{ id: 'm1', label: 'Ritos', min: 0, max: 5, defaultValue: 2 }],
      required: false,
    }
    const { container } = render(<GenericDialog form={stubForm(multiPrompt)} />)
    expect(container.querySelector('.cancel-btn')).not.toBeNull()
  })

  it('survives prompt null -> defined -> null without a hooks-order crash (AUDIT-01)', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const view = render(<GenericDialog form={stubForm(null)} />)
    expect(view.container.innerHTML).toBe('')
    view.rerender(<GenericDialog form={stubForm(booleanPrompt)} />)
    expect(view.container.innerHTML).not.toBe('')
    view.rerender(<GenericDialog form={stubForm(null)} />)
    expect(view.container.innerHTML).toBe('')
    view.rerender(<GenericDialog form={stubForm(booleanPrompt)} />)
    expect(view.container.innerHTML).not.toBe('')
    const hookErrors = errorSpy.mock.calls.filter((args) =>
      args.some((a) => typeof a === 'string' && a.includes('fewer hooks')),
    )
    expect(hookErrors).toHaveLength(0)
  })
})
