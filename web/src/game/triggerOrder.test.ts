import { describe, expect, it } from 'vitest'
import { gameObjectNames, triggerDisplayName, triggerExtraRules, triggerPickOrder, triggerRuleText } from './triggerOrder'
import type { FeedbackCard } from './feedback/types'
import type { GameView } from '../net/types'

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

describe('triggerExtraRules', () => {
  it('keeps the "Related objects" line that CardsView appends for pointer targets', () => {
    const extra = triggerExtraRules(card({
      rules: [
        'Whenever another creature enters, you gain 1 life.',
        "<i>Related objects: [Grizzly Bears, Rival]</i>",
      ],
    }))
    expect(extra).toEqual(['Related objects: [Grizzly Bears, Rival]'])
  })

  it('drops regular rules', () => {
    expect(triggerExtraRules(card())).toEqual([])
  })
})

describe('triggerPickOrder', () => {
  it('answers bottom-up: the last in resolution order is picked first', () => {
    expect(triggerPickOrder(['top', 'mid', 'bottom'])).toEqual(['bottom', 'mid', 'top'])
    expect(triggerPickOrder([])).toEqual([])
  })
})

describe('gameObjectNames', () => {
  it('maps player ids, battlefield, graveyard and stack objects to display names', () => {
    const game = {
      stack: { s1: { id: 's1', name: 'Lightning Bolt' } },
      myHand: { h1: { id: 'h1', displayName: 'Island' } },
      myHelperEmblems: {},
      players: [
        {
          playerId: 'p2',
          name: 'Rival',
          battlefield: { b1: { id: 'b1', name: 'Grizzly Bears' } },
          graveyard: { g1: { id: 'g1', name: 'Mountain' } },
          exile: {},
          commandList: [{ id: 'c1', name: 'Atraxa' }],
        },
      ],
    } as unknown as GameView
    const names = gameObjectNames(game)
    expect(names.get('p2')).toBe('Rival')
    expect(names.get('b1')).toBe('Grizzly Bears')
    expect(names.get('g1')).toBe('Mountain')
    expect(names.get('s1')).toBe('Lightning Bolt')
    expect(names.get('h1')).toBe('Island')
    expect(names.get('c1')).toBe('Atraxa')
    expect(gameObjectNames(null).size).toBe(0)
  })
})
