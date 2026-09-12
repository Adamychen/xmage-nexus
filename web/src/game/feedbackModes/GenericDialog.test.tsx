import { cleanup, render } from '@testing-library/react'
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
