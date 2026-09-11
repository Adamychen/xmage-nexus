import { describe, expect, it } from 'vitest'
import { normalizePrompt } from '../src/xmage/promptView.ts'

const controlledPlayer = {
  playerId: 'p1',
  name: 'me',
  controlled: true,
  isActive: true,
  hasPriority: true,
  life: 20,
  handCount: 1,
  libraryCount: 53,
  battlefield: {},
  graveyard: {},
  manaPool: { red: 1, green: 0, blue: 0, white: 0, black: 0, colorless: 0 },
}

describe('normalizePrompt', () => {
  it('returns null for non-prompt methods', () => {
    expect(normalizePrompt('GAME_UPDATE', {}, 'g1')).toBeNull()
    expect(normalizePrompt('GAME_SELECT', {}, null)).toBeNull()
  })

  it('maps a priority GAME_SELECT to select mode with playable ids', () => {
    const view = normalizePrompt(
      'GAME_SELECT',
      {
        message: 'Play spells and abilities',
        options: { queryType: 'PLAY_ABILITY' },
        gameView: {
          myHand: { bolt: { name: 'Lightning Bolt', cardTypes: ['INSTANT'] } },
          canPlayObjects: { objects: { bolt: { basicCastAbilities: [{ id: 'a1', value: 'Cast' }] } } },
          players: [controlledPlayer],
        },
      },
      'g1',
    )
    expect(view?.mode).toBe('select')
    expect(view?.canPass).toBe(true)
    expect(view?.options).toEqual([{ id: 'bolt', label: 'Lightning Bolt', value: 'bolt' }])
  })

  it('maps a combat GAME_SELECT to combat mode with attacker ids and labels', () => {
    const view = normalizePrompt(
      'GAME_SELECT',
      {
        message: 'Declare attackers',
        options: { possibleAttackers: ['a1'] },
        gameView: {
          players: [{ ...controlledPlayer, battlefield: { a1: { name: 'Raging Goblin' } } }],
        },
      },
      'g1',
    )
    expect(view?.mode).toBe('combat')
    expect(view?.flags).toEqual(['combat'])
    expect(view?.options).toEqual([{ id: 'a1', label: 'Raging Goblin', value: 'a1' }])
  })

  it('normalizes a mulligan GAME_ASK to boolean with semantic values', () => {
    const view = normalizePrompt(
      'GAME_ASK',
      {
        question: 'Keep your hand?',
        options: { 'UI.left.btn.text': 'Mulligan', 'UI.right.btn.text': 'Keep' },
      },
      'g1',
    )
    expect(view?.mode).toBe('boolean')
    expect(view?.flags).toEqual(['mulligan'])
    expect(view?.options).toEqual([
      { id: 'left', label: 'Mulligan', value: 'true' },
      { id: 'right', label: 'Keep', value: 'false' },
    ])
  })

  it('normalizes GAME_TARGET with card ids and labels', () => {
    const view = normalizePrompt(
      'GAME_TARGET',
      {
        message: 'Select target',
        targets: ['c1'],
        gameView: { players: [{ ...controlledPlayer, battlefield: { c1: { name: 'Elvish Mystic' } } }] },
      },
      'g1',
    )
    expect(view?.mode).toBe('uuid')
    expect(view?.options).toEqual([{ id: 'c1', label: 'Elvish Mystic', value: 'c1' }])
  })

  it('normalizes amounts and multi amounts', () => {
    const amount = normalizePrompt('GAME_GET_AMOUNT', { message: 'Choose X', min: 0, max: 5 }, 'g1')
    expect(amount?.mode).toBe('integer')
    expect(amount?.min).toBe(0)
    expect(amount?.max).toBe(5)

    const multi = normalizePrompt(
      'GAME_GET_MULTI_AMOUNT',
      { message: 'Distribute', messages: [{ id: 'd1', message: 'damage', min: 0, max: 3, defaultValue: 1 }] },
      'g1',
    )
    expect(multi?.mode).toBe('multiString')
    expect(multi?.items?.[0]).toMatchObject({ id: 'd1', min: 0, max: 3, defaultValue: 1 })
    expect(multi?.min).toBe(0)
    expect(multi?.max).toBe(3)
  })

  it('normalizes GAME_CHOOSE_COLOR to string options', () => {
    const view = normalizePrompt('GAME_CHOOSE_COLOR', { message: 'Choose a color' }, 'g1')
    expect(view?.mode).toBe('string')
    expect(view?.options.map((option) => option.id)).toEqual(['W', 'U', 'B', 'R', 'G'])
  })

  it('normalizes GAME_PLAY_MANA with mana sources from the embedded game view', () => {
    const view = normalizePrompt(
      'GAME_PLAY_MANA',
      {
        message: 'Pay {R}',
        gameView: {
          canPlayObjects: { objects: { land1: { basicManaAbilities: [{ id: 'm1', value: 'Add {R}' }] } } },
          players: [{ ...controlledPlayer, battlefield: { land1: { name: 'Mountain' } } }],
        },
      },
      'g1',
    )
    expect(view?.mode).toBe('mana')
    expect(view?.playerId).toBe('p1')
    expect(view?.options).toEqual([{ id: 'land1', label: 'Mountain', value: 'land1' }])
  })

  it('exposes the special button (auto-pay) on GAME_PLAY_MANA', () => {
    const view = normalizePrompt('GAME_PLAY_MANA', { message: 'Pay {R}', options: { queryType: 'PLAY_MANA' } }, 'g1')
    expect(view?.special).toBe(true)
    expect(view?.specialLabel).toContain('special')
    expect(view?.queryType).toBe('PLAY_MANA')
  })

  it('exposes the special button on combat selects', () => {
    const view = normalizePrompt(
      'GAME_SELECT',
      {
        message: 'Declare attackers',
        options: { possibleAttackers: ['a1'], specialButton: 'All attack' },
        gameView: { players: [{ ...controlledPlayer, battlefield: { a1: { name: 'Raging Goblin' } } }] },
      },
      'g1',
    )
    expect(view?.special).toBe(true)
    expect(view?.specialLabel).toBe('All attack')
  })

  it('normalizes GAME_CHOOSE_CARDS to card options', () => {
    const view = normalizePrompt(
      'GAME_CHOOSE_CARDS',
      { message: 'Choose a card', cardsView1: { c1: { id: 'c1', name: 'Forest' } } },
      'g1',
    )
    expect(view?.mode).toBe('uuid')
    expect(view?.options).toEqual([{ id: 'c1', label: 'Forest', value: 'c1' }])
    expect(view?.cards?.[0]).toMatchObject({ id: 'c1', name: 'Forest' })
  })
})
