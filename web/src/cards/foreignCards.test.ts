import { afterEach, describe, expect, it } from 'vitest'
import type { CardView, GameView } from '../net/types'
import { foreignCardIds, isForeignCard, noteGameForArt } from './foreignCards'

const c = (id: string, extra: Partial<CardView> = {}) => ({ id, name: 'Shock', ...extra }) as CardView

function player(playerId: string, zones: Record<string, unknown> = {}) {
  return { playerId, battlefield: {}, graveyard: {}, exile: {}, sideboard: {}, commandList: [], topCard: null, ...zones }
}

function game(extra: Record<string, unknown>): GameView {
  return { myPlayerId: 'me', myHand: {}, players: [], opponentHands: {}, watchedHands: {}, stack: {}, ...extra } as unknown as GameView
}

describe('foreignCards', () => {
  afterEach(() => noteGameForArt(null))

  it('DCK-32: collects every zone the view places with another player', () => {
    const ids = foreignCardIds(game({
      myHand: { h1: c('h1') },
      players: [
        player('me', { battlefield: { m1: c('m1') }, graveyard: { m2: c('m2') } }),
        player('opp', {
          battlefield: { o1: c('o1') },
          graveyard: { o2: c('o2') },
          exile: { o3: c('o3') },
          sideboard: { o4: c('o4') },
          commandList: [{ id: 'o5' }],
          topCard: c('o6'),
        }),
      ],
      opponentHands: { opp: { o7: { id: 'o7' } } },
      watchedHands: { opp: { o8: { id: 'o8' } } },
      stack: { s1: c('s1', { controllerId: 'opp' }), s2: c('s2', { controllerId: 'me' }) },
    }))
    expect([...ids].sort()).toEqual(['o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7', 'o8', 's1'])
  })

  it('DCK-32: a spectator owns nothing, so every player\'s cards are foreign', () => {
    const ids = foreignCardIds(game({
      myPlayerId: null,
      players: [player('a', { battlefield: { a1: c('a1') } }), player('b', { graveyard: { b1: c('b1') } })],
    }))
    expect([...ids].sort()).toEqual(['a1', 'b1'])
  })

  it('DCK-32: follows the current game and forgets it when the game is gone', () => {
    noteGameForArt(game({ players: [player('me'), player('opp', { battlefield: { o1: c('o1') } })] }))
    expect(isForeignCard(c('o1'))).toBe(true)
    expect(isForeignCard(c('x'))).toBe(false)
    expect(isForeignCard({ name: 'Shock' } as CardView)).toBe(false)
    noteGameForArt(null)
    expect(isForeignCard(c('o1'))).toBe(false)
  })
})
