import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import GenericDialog from './GenericDialog'
import type { UseFeedbackForm } from '../useFeedbackForm'
import type { FeedbackOption, FeedbackPrompt } from '../feedback/types'
import * as cmds from '../../net/commands'
import { setLanguage } from '../../i18n'

vi.mock('../../net/commands', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../net/commands')>()),
  sendPlayerString: vi.fn(async () => ({ ok: true })),
  sendPlayerUUID: vi.fn(async () => ({ ok: true })),
  sendPlayerInteger: vi.fn(async () => ({ ok: true })),
}))

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
    sendNow: () => Promise.resolve(true),
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

  it('KEY-7: grid: roving tabindex with arrow navigation, Enter and digit shortcuts (1-9)', () => {
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
    const steppers = Array.from(container.querySelectorAll('.multi-stepper .ui-icon-btn'))
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

  it('integer mode: renders the source name (origin) when the prompt carries one', () => {
    const amountPrompt: FeedbackPrompt = {
      method: 'GAME_GET_AMOUNT',
      gameId: 'g1',
      title: 'Amount',
      message: 'Choose an amount',
      mode: 'integer',
      options: [],
      min: 0,
      max: 5,
      sourceName: 'Walking Ballista',
    }
    const { container } = render(<GenericDialog form={stubForm(amountPrompt)} />)
    expect(container.querySelector('.dlg-source')?.textContent).toContain('Walking Ballista')
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

  it('multiString mode: renders the source name (origin) when the prompt carries one, and canCancel maps to the cancel button', () => {
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
      sourceName: 'Elvish Warrior',
    }
    const { container } = render(<GenericDialog form={stubForm(multiPrompt)} />)
    expect(container.querySelector('.dlg-source')?.textContent).toContain('Elvish Warrior')
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

const elfOptions: FeedbackOption[] = [
  { id: 'elf-warrior', label: 'Elf Warrior', value: 'Elf Warrior' },
  { id: 'goblin', label: 'Goblin', value: 'Goblin' },
]

function choicePrompt(options: FeedbackOption[]): FeedbackPrompt {
  return {
    method: 'GAME_CHOOSE_CHOICE',
    gameId: 'g1',
    title: 'Choose',
    message: 'Name one',
    mode: 'string',
    options,
    min: 0,
    max: 1,
  }
}

function typedForm(prompt: FeedbackPrompt, textValue: string): UseFeedbackForm {
  const q = textValue.trim().toLowerCase()
  const filteredStringOptions = prompt.options.filter((opt) => !q || opt.label.toLowerCase().includes(q) || opt.value.toLowerCase().includes(q))
  return {
    ...stubForm(prompt),
    textValue,
    filteredStringOptions,
    send: async (action) => { await action() },
  }
}

describe('GenericDialog typed choice (string mode)', () => {
  afterEach(() => {
    cleanup()
    vi.mocked(cmds.sendPlayerString).mockClear()
  })

  it('a partial unique match sends the full option value on Enter', () => {
    const { container } = render(<GenericDialog form={typedForm(choicePrompt(elfOptions), 'Elf')} />)
    fireEvent.keyDown(container.querySelector('.feedback-string-wrap .feedback-input-box input')!, { key: 'Enter' })
    expect(cmds.sendPlayerString).toHaveBeenCalledTimes(1)
    expect(cmds.sendPlayerString).toHaveBeenCalledWith('Elf Warrior', 'g1')
  })

  it('an exact match wins over the partial and is case-insensitive', () => {
    const options = [...elfOptions, { id: 'elf', label: 'Elf', value: 'Elf' }]
    const { container } = render(<GenericDialog form={typedForm(choicePrompt(options), 'elf')} />)
    fireEvent.keyDown(container.querySelector('.feedback-string-wrap .feedback-input-box input')!, { key: 'Enter' })
    expect(cmds.sendPlayerString).toHaveBeenCalledWith('Elf', 'g1')
  })

  it('an ambiguous partial match sends nothing and keeps Confirm disabled', () => {
    const options: FeedbackOption[] = [
      { id: 'a', label: 'Elf Warrior', value: 'Elf Warrior' },
      { id: 'b', label: 'Elf Druid', value: 'Elf Druid' },
    ]
    const { container } = render(<GenericDialog form={typedForm(choicePrompt(options), 'Elf')} />)
    fireEvent.keyDown(container.querySelector('.feedback-string-wrap .feedback-input-box input')!, { key: 'Enter' })
    expect(cmds.sendPlayerString).not.toHaveBeenCalled()
    const confirm = container.querySelector<HTMLButtonElement>('.feedback-dialog-actions button')!
    expect(confirm.disabled).toBe(true)
    fireEvent.click(confirm)
    expect(cmds.sendPlayerString).not.toHaveBeenCalled()
  })

  it('a prompt without options still sends the typed text (free text)', () => {
    const { container } = render(<GenericDialog form={typedForm(choicePrompt([]), 'Lightning Bolt')} />)
    fireEvent.keyDown(container.querySelector('.feedback-string-wrap .feedback-input-box input')!, { key: 'Enter' })
    expect(cmds.sendPlayerString).toHaveBeenCalledWith('Lightning Bolt', 'g1')
  })
})

describe('GenericDialog amount range (integer mode)', () => {
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

  afterEach(() => {
    cleanup()
  })

  it('MNA-10: disables Confirm and flags the range hint when the amount is outside [min, max]', () => {
    const { container, rerender } = render(<GenericDialog form={{ ...stubForm(amountPrompt), amount: 7 }} />)
    const confirm = container.querySelector<HTMLButtonElement>('.feedback-dialog-actions button')!
    expect(confirm.disabled).toBe(true)
    expect(container.querySelector('.ui-field-error')).not.toBeNull()
    rerender(<GenericDialog form={{ ...stubForm(amountPrompt), amount: Number.NaN }} />)
    expect(container.querySelector<HTMLButtonElement>('.feedback-dialog-actions button')!.disabled).toBe(true)
    rerender(<GenericDialog form={{ ...stubForm(amountPrompt), amount: 3 }} />)
    expect(container.querySelector<HTMLButtonElement>('.feedback-dialog-actions button')!.disabled).toBe(false)
    expect(container.querySelector('.ui-field-error')).toBeNull()
  })
})

describe('GenericDialog multi-select (uuid, min 0)', () => {
  afterEach(() => {
    cleanup()
  })

  it('keeps Confirm disabled while nothing is selected', () => {
    const multiPrompt: FeedbackPrompt = {
      method: 'GAME_SELECT_CARDS',
      gameId: 'g1',
      title: 'Choose cards',
      message: 'Choose up to two',
      mode: 'uuid',
      options: elfOptions.map((opt) => ({ ...opt, id: opt.id, value: opt.id })),
      min: 0,
      max: 2,
    }
    const { container } = render(<GenericDialog form={{ ...stubForm(multiPrompt), selected: [] }} />)
    expect(container.querySelector<HTMLButtonElement>('.feedback-dialog-actions button')!.disabled).toBe(true)
  })
})

describe('GenericDialog grid keyboard navigation on an empty grid', () => {
  afterEach(() => {
    cleanup()
  })

  it('ArrowDown on an empty search result does not leave the roving tab stop at -1', () => {
    const options = Array.from({ length: 8 }, (_, i) => ({ id: `o${i}`, label: `Card ${i}`, value: `v${i}` }))
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
    const { container } = render(<GenericDialog form={stubForm(gridPrompt)} />)
    const search = container.querySelector<HTMLInputElement>('.feedback-input-box input')!
    fireEvent.change(search, { target: { value: 'zzz' } })
    expect(container.querySelectorAll('.feedback-choice-card').length).toBe(0)
    fireEvent.keyDown(search, { key: 'ArrowDown' })
    fireEvent.change(search, { target: { value: '' } })
    expect(container.querySelectorAll<HTMLButtonElement>('.feedback-choice-card')[0].tabIndex).toBe(0)
  })
})

describe('GenericDialog combat declaration direction', () => {
  beforeEach(() => {
    setLanguage('en')
  })
  afterEach(() => {
    cleanup()
  })

  it('CMB-11: a combat prompt shows the attacker title from the prompt flag, not the translated title', () => {
    const combatPrompt: FeedbackPrompt = {
      method: 'GAME_SELECT',
      gameId: 'g1',
      title: 'Déclaration des attaquants',
      message: 'Declare attackers',
      mode: 'combat',
      options: [],
      min: 0,
      max: 0,
      required: true,
      isDeclaringAttackers: true,
    }
    const { container } = render(<GenericDialog form={stubForm(combatPrompt)} />)
    expect(container.querySelector('#feedback-title')?.textContent).toBe('Declare Attackers')
  })
})
