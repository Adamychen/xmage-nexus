import { describe, expect, it } from 'vitest'
import { triggerDisplayName, triggerRuleText } from './triggerOrder'
import type { FeedbackCard } from './feedback/types'

function card(overrides: Partial<FeedbackCard> = {}): FeedbackCard {
  return {
    id: 'c1',
    name: 'Soul Warden',
    rules: [
      'Soul Warden enters the battlefield tapped.',
      'Whenever another creature enters the battlefield, you gain 1 life.',
    ],
    ...overrides,
  }
}

describe('triggerRuleText', () => {
  it('picks the triggered-ability rule and substitutes {this}', () => {
    expect(triggerRuleText(card())).toBe('Whenever another creature enters the battlefield, you gain 1 life.')
    expect(triggerRuleText(card({ rules: ['Whenever {this} attacks, draw a card.'] }))).toBe(
      'Whenever Soul Warden attacks, draw a card.',
    )
  })

  it('falls back to the first rule, then the card name', () => {
    expect(triggerRuleText(card({ rules: ['Flying'] }))).toBe('Flying')
    expect(triggerRuleText(card({ rules: [] }))).toBe('Soul Warden')
    expect(triggerRuleText(card({ rules: undefined }))).toBe('Soul Warden')
  })

  it('prefers displayName when present', () => {
    expect(triggerDisplayName(card({ displayName: 'Warden!' })) ).toBe('Warden!')
    expect(triggerDisplayName(card())).toBe('Soul Warden')
  })
})
