import { describe, expect, it } from 'vitest'
import type { CardView } from '../../net/types'
import { stackCardText } from './stackCardText'

const spell = (over: Partial<CardView>): CardView =>
  ({ id: 'spell-1', name: 'Spell', mageObjectType: 'SPELL', cardTypes: ['INSTANT'], rules: [], ...over }) as CardView

const ability = (over: Partial<CardView>): CardView =>
  ({ id: 'ability-1', name: 'Ability', mageObjectType: 'TRIGGERED_ABILITY', rules: [], ...over }) as CardView

describe('stackCardText', () => {
  it('STK-9: an ability shows its own text and nothing the server appended', () => {
    const card = ability({ rules: ['Whenever another creature enters, you gain 1 life.', '<i>Related objects: [Grizzly Bears]</i>'] })
    expect(stackCardText(card)).toEqual({ lines: ['Whenever another creature enters, you gain 1 life.'], xLine: null })
  })

  it('STK-9: a modal spell shows only the chosen modes, without the choose header', () => {
    const card = spell({
      rules: [
        'Choose two &mdash;<br>&bull Return target creature card from your graveyard to your hand.<br>&bull Target player discards a card.<br>&bull Destroy target artifact.',
        "<span color='green'><i>Chosen mode: Target player discards a card.</i></span>",
        "<span color='green'><i>Chosen mode: Destroy target artifact.</i></span>",
      ],
    })
    expect(stackCardText(card).lines).toEqual(['Target player discards a card.', 'Destroy target artifact.'])
  })

  it('STK-9: the announced X is its own last line', () => {
    const card = spell({
      rules: ['Fireball deals X damage divided evenly, rounded down, among any number of targets.'],
      cardIcons: [{ cardIconType: 'OTHER_COST_X', text: 'x=4', hint: 'Announced X = 4' }],
    })
    expect(stackCardText(card)).toEqual({
      lines: ['Fireball deals X damage divided evenly, rounded down, among any number of targets.'],
      xLine: 'X = 4',
    })
  })

  it('STK-9: target-on-stack lines and hints are dropped', () => {
    const card = spell({ rules: ['Counter target spell.', "<span color='green'><i>Target on stack: Fireball [abc]", '<br/><hintstart/>', 'Hint: something'] })
    expect(stackCardText(card).lines).toEqual(['Counter target spell.'])
  })

  it('STK-9: localized rules replace the printed ones and chosen modes still show', () => {
    const card = spell({ rules: ['Choose one &mdash;<br>&bull A.<br>&bull B.', "<span color='green'><i>Chosen mode: B.</i></span>"] })
    expect(stackCardText(card, ['Elige uno —<br>• A.<br>• B.']).lines).toEqual(['B.'])
  })

  it('STK-9: a modal ability keeps what triggers it and shows only the chosen mode', () => {
    const card = ability({ rules: ['When Charming Prince enters, choose one &mdash;<br>&bull Scry 2.<br>&bull You gain 3 life.', "<span color='green'><i>Chosen mode: You gain 3 life.</i></span>"] })
    expect(stackCardText(card).lines).toEqual(['When Charming Prince enters,', 'You gain 3 life.'])
  })

  it('STK-9: a spell with no rules shows an empty text box', () => {
    expect(stackCardText(spell({ rules: [] }))).toEqual({ lines: [], xLine: null })
  })

})
