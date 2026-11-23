import { describe, expect, it } from 'vitest'
import { stackRulesText } from './stackEntries'
import type { CardView } from '../net/types'

const ability = (rules: string[]): CardView => ({ id: 'a1', name: 'Ability', rules } as unknown as CardView)

describe('the text of an object on the stack', () => {
  it('STK-7: keeps the ability text and drops the lines that only name its targets', () => {
    const text = stackRulesText(ability([
      'Whenever this creature attacks, put a +1/+1 counter on it.',
      "<i>Related objects: [Kappa Cannoneer, Skrelv, Defector Mite]</i>",
      "<span color='green'><i>Target on stack: Lightning Bolt</i></span>",
    ]))
    expect(text).toBe('Whenever this creature attacks, put a +1/+1 counter on it.')
  })

  it('STK-7: a mode the ability chose is text, not a target, and stays', () => {
    const text = stackRulesText(ability([
      'Choose one —',
      "<span color='green'><i>Chosen mode: Destroy target creature.</i></span>",
    ]))
    expect(text).toContain('Chosen mode')
  })

  it('an object with nothing but target lines has no text to read', () => {
    expect(stackRulesText(ability(['<i>Related objects: [Forest]</i>']))).toBeNull()
  })
})
