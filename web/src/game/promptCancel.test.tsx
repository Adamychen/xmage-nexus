import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CHOOSE_OPTION_CANCEL_ID, parseFeedback, type FeedbackPrompt } from './feedback'
import type { UseFeedbackForm } from './useFeedbackForm'
import GenericDialog from './feedbackModes/GenericDialog'
import TargetBar from './feedbackModes/TargetBar'
import ManaBar from './feedbackModes/ManaBar'
import PlaneswalkerAbilityDialog from './PlaneswalkerAbilityDialog'
import Modal from '../ui/Modal'

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

const parsed = (method: string, data: unknown): FeedbackPrompt => {
  const prompt = parseFeedback(method, 'g1', data)
  if (!prompt) throw new Error(`no prompt for ${method}`)
  return prompt
}

const abilityPicker = () => parsed('GAME_CHOOSE_ABILITY', {
  message: 'Choose spell or ability to play<br>Rod of Ruin',
  choices: { 'ability-1': '{3}, {T}: Rod of Ruin deals 1 damage to any target.' },
})

const activationTarget = () => parsed('GAME_TARGET', {
  message: 'Select any target',
  flag: false,
  targets: ['opp-1'],
  options: { possibleTargets: ['opp-1'] },
})

const pressEscape = async (target: Element | Window = window) => {
  await act(async () => {
    fireEvent.keyDown(target, { key: 'Escape' })
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

afterEach(() => cleanup())

describe('PRM-13: backing out of a spell or ability being played', () => {
  it('PRM-13: the ability picker, an activation target and the payment are cancelable; a required or finishable target is not', () => {
    expect(abilityPicker().cancelable).toBe(true)
    expect(activationTarget().cancelable).toBe(true)
    expect(parsed('GAME_PLAY_MANA', { message: 'Pay {3}', options: { queryType: 'PLAY_MANA' } }).cancelable).toBe(true)

    expect(parsed('GAME_TARGET', { message: 'Select target creature', targets: ['c1'] }).cancelable).toBeUndefined()
    const done = parsed('GAME_TARGET', {
      message: 'Search your library for a basic land card',
      flag: false,
      targets: ['l1'],
      options: { possibleTargets: ['l1'], 'UI.right.btn.text': 'Done' },
    })
    expect(done.cancelable).toBeUndefined()
  })

  it('PRM-13: a mode picker that carries the server Cancel entry is not given a second one', () => {
    const modes = parsed('GAME_CHOOSE_ABILITY', {
      message: 'Choose mode (selected 0 of 1, min 1)',
      choices: { m1: '1. Draw a card.', [CHOOSE_OPTION_CANCEL_ID]: 'Cancel' },
    })
    expect(modes.cancelable).toBeUndefined()
  })

  it('PRM-13: the ability picker shows Cancel and Escape answers it', async () => {
    const finishOptionalTarget = vi.fn()
    const cancel = vi.fn()
    render(<GenericDialog form={stubForm(abilityPicker(), { finishOptionalTarget, cancel })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(finishOptionalTarget).toHaveBeenCalledTimes(1)
    await pressEscape()
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it('PRM-13: Escape on a mode picker picks the server Cancel entry', async () => {
    const selectOption = vi.fn()
    const modes = parsed('GAME_CHOOSE_ABILITY', {
      message: 'Choose mode',
      choices: { m1: '1. Draw a card.', [CHOOSE_OPTION_CANCEL_ID]: 'Cancel' },
    })
    render(<GenericDialog form={stubForm(modes, { selectOption })} />)
    await pressEscape()
    expect(selectOption).toHaveBeenCalledWith(expect.objectContaining({ id: CHOOSE_OPTION_CANCEL_ID }))
  })

  it('PRM-13: the planeswalker picker shows Cancel and Escape answers it', async () => {
    const cancel = vi.fn()
    const pw = parsed('GAME_CHOOSE_ABILITY', {
      message: 'Choose spell or ability to play<br>Jace Beleren',
      choices: { a1: '+2: Each player draws a card.', a2: '-1: Target player draws a card.' },
    })
    expect(pw.isPlaneswalkerAbility).toBe(true)
    render(<PlaneswalkerAbilityDialog prompt={pw} send={() => {}} cancel={cancel} busy={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await pressEscape()
    expect(cancel).toHaveBeenCalledTimes(2)
  })

  it('PRM-13: an activation target says Cancel, not Finish, and Escape answers it', async () => {
    const finishOptionalTarget = vi.fn()
    const { container } = render(<TargetBar form={stubForm(activationTarget(), { finishOptionalTarget })} />)
    const button = container.querySelector('.action-prompt-actions button')!
    expect(button.textContent).toBe('Cancelar')
    fireEvent.click(button)
    await pressEscape()
    expect(finishOptionalTarget).toHaveBeenCalledTimes(2)
  })

  it('PRM-13: Escape on the mana bar cancels the payment', async () => {
    const cancel = vi.fn()
    render(<ManaBar form={stubForm(parsed('GAME_PLAY_MANA', { message: 'Pay {3}' }), { cancel })} />)
    await pressEscape()
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it('PRM-13: Escape is left to a text field, to an open dialog and to a handler that claimed it', async () => {
    const cancel = vi.fn()
    render(<ManaBar form={stubForm(parsed('GAME_PLAY_MANA', { message: 'Pay {3}' }), { cancel })} />)

    const input = document.createElement('input')
    document.body.appendChild(input)
    await pressEscape(input)
    input.remove()

    const claim = (e: KeyboardEvent) => e.preventDefault()
    window.addEventListener('keydown', claim)
    await pressEscape()
    window.removeEventListener('keydown', claim)

    const onClose = vi.fn()
    const dialog = render(<Modal backdropClassName="b" dialogClassName="d" labelledBy="t" onEscape={onClose}><h2 id="t">Inspector</h2></Modal>)
    await pressEscape()
    expect(onClose).toHaveBeenCalledTimes(1)
    dialog.unmount()

    expect(cancel).not.toHaveBeenCalled()
  })

  it('PRM-13: a required target offers no cancel and ignores Escape', async () => {
    const finishOptionalTarget = vi.fn()
    const required = parsed('GAME_TARGET', { message: 'Select target creature', targets: ['c1'] })
    const { container } = render(<TargetBar form={stubForm(required, { finishOptionalTarget })} />)
    expect(container.querySelector('.action-prompt-actions button')).toBeNull()
    await pressEscape()
    expect(finishOptionalTarget).not.toHaveBeenCalled()
  })
})
