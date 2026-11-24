import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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
    sendNow: () => Promise.resolve(true),
    cancel: () => {},
    finishOptionalTarget: () => {},
    selectOption: () => {},
    confirmSelected: () => {},
    confirmAmount: () => {},
    confirmMultiAmount: () => {},
  }
}

describe('prompt bars live hints', () => {
  it('MNA-1: ManaBar leaves the hint out: the cost is the order, read on the board', () => {
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
    expect(container.querySelector('.action-prompt-hint'), 'the dock keeps no hint').toBeNull()
  })

  it('TGT-1: TargetBar leaves the hint out too, and keeps the count of targets picked', () => {
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
    expect(container.querySelector('.action-prompt-hint'), 'the dock keeps no hint').toBeNull()
  })

  it('PRM-7: TargetBar hides every action when the target is required (sending false only makes the server re-ask)', () => {
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
        required: true,
      })} />,
    )
    expect(container.querySelector('.action-prompt-actions button')).toBeNull()
  })

  it('PRM-7: TargetBar offers only the optional finish button (no cancel) when required is false', () => {
    const finishOptionalTarget = vi.fn()
    const { container } = render(
      <TargetBar form={{
        ...stubForm({
          method: 'GAME_TARGET',
          gameId: 'g1',
          title: 'Target',
          message: 'You may choose a target',
          mode: 'uuid',
          options: [],
          min: 0,
          max: 1,
          required: false,
        }),
        finishOptionalTarget,
      }} />,
    )
    expect(container.querySelector('.cancel-btn'), 'un objetivo opcional no se cancela, se termina').toBeNull()
    // PRM-19: ese botón es ahora el principal, en el sitio del de prioridad
    const finish = container.querySelector<HTMLButtonElement>('[data-testid="prompt-action"]')!
    expect(finish.textContent).toContain('Terminar')
    fireEvent.click(finish)
    expect(finishOptionalTarget).toHaveBeenCalledTimes(1)
  })
})
