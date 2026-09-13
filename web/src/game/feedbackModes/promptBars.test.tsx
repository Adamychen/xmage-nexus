import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ManaBar from './ManaBar'
import TargetBar from './TargetBar'
import type { UseFeedbackForm } from '../useFeedbackForm'
import type { FeedbackPrompt } from '../feedback/types'

function stubForm(prompt: FeedbackPrompt): UseFeedbackForm {
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

describe('prompt bars live hints', () => {
  it('ManaBar announces the hint via role=status', () => {
    const { container } = render(
      <ManaBar form={stubForm({
        method: 'GAME_PLAY_MANA',
        gameId: 'g1',
        title: 'Pay',
        message: 'Pay {1}',
        mode: 'mana',
        options: [],
        min: 0,
        max: 0,
      })} />,
    )
    const hint = container.querySelector('.action-prompt-hint')!
    expect(hint.getAttribute('role')).toBe('status')
    expect(hint.getAttribute('aria-live')).toBe('polite')
  })

  it('TargetBar announces the hint via role=status', () => {
    const { container } = render(
      <TargetBar form={stubForm({
        method: 'GAME_TARGET',
        gameId: 'g1',
        title: 'Target',
        message: 'Choose a target',
        mode: 'uuid',
        options: [],
        min: 0,
        max: 1,
      })} />,
    )
    const hint = container.querySelector('.action-prompt-hint')!
    expect(hint.getAttribute('role')).toBe('status')
    expect(hint.getAttribute('aria-live')).toBe('polite')
  })
})
