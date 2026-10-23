// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import CombatBar from './CombatBar'
import { setLanguage } from '../../i18n'
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

function combatPrompt(title: string, attackers: boolean): FeedbackPrompt {
  return {
    method: 'GAME_SELECT',
    gameId: 'g1',
    title,
    message: 'Declare attackers',
    mode: 'combat',
    options: [],
    min: 0,
    max: 0,
    required: true,
    special: attackers,
    isDeclaringAttackers: attackers ? true : undefined,
  }
}

// The prompt titles as parse.ts produces them under each UI language.
const ATTACK_TITLES = [
  'Declare Attackers',
  'Declarar Atacantes',
  'Angreifer deklarieren',
  'Déclaration des attaquants',
  'Dichiara attaccanti',
  'Объявление атакующих',
  '攻撃クリーチャー指定',
  '宣告攻击者',
]

describe('CombatBar attacker/blocker labels', () => {
  beforeEach(() => {
    setLanguage('en')
  })
  afterEach(() => {
    cleanup()
  })

  it('CMB-11: an attack window shows attacker labels whatever translation its title arrived in', () => {
    for (const title of ATTACK_TITLES) {
      const { container } = render(<CombatBar form={stubForm(combatPrompt(title, true))} />)
      expect(container.textContent, `attack title: ${title}`).toContain('Declare Attackers')
      expect(container.textContent, `attack title: ${title}`).toContain('Confirm Attackers')
      expect(container.textContent, `attack title: ${title}`).not.toContain('Declare Blockers')
      cleanup()
    }
  })

  it('CMB-11: a block window shows blocker labels', () => {
    const { container } = render(<CombatBar form={stubForm(combatPrompt('Déclaration des bloqueurs', false))} />)
    expect(container.textContent).toContain('Declare Blockers')
    expect(container.textContent).toContain('Confirm Blockers')
    expect(container.textContent).not.toContain('Declare Attackers')
  })
})
