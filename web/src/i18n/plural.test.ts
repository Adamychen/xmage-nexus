import { beforeEach, describe, expect, it } from 'vitest'
import { plural, switchLanguage } from './index'

describe('plural', () => {
  describe('en', () => {
    beforeEach(async () => {
      await switchLanguage('en')
    })

    it('uses the singular for 1 and the plural otherwise', () => {
      expect(plural('lobby', 'tournament_round', 1)).toBe('round')
      expect(plural('lobby', 'tournament_round', 2)).toBe('rounds')
      expect(plural('dialogs', 'viewer_card', 1)).toBe('card')
      expect(plural('dialogs', 'viewer_card', 2)).toBe('cards')
    })

    it('fills the count into the feed and the match-replay labels', () => {
      expect(plural('game', 'feed_events', 1)).toBe('1 event')
      expect(plural('game', 'feed_events', 2)).toBe('2 events')
      expect(plural('lobby', 'match_replay', 1)).toBe('Watch Replay')
      expect(plural('lobby', 'match_replay', 2, { number: 2 })).toBe('Replay G2')
    })
  })

  describe('ru', () => {
    beforeEach(async () => {
      await switchLanguage('ru')
    })

    it('picks the one, few and many forms of a Russian noun', () => {
      expect(plural('lobby', 'tournament_round', 1)).toBe('раунд')
      expect(plural('lobby', 'tournament_round', 2)).toBe('раунда')
      expect(plural('lobby', 'tournament_round', 5)).toBe('раундов')
      expect(plural('lobby', 'tournament_round', 11)).toBe('раундов')
      expect(plural('lobby', 'tournament_round', 21)).toBe('раунд')
    })

    it('applies the same forms to the other counted nouns', () => {
      expect(plural('dialogs', 'viewer_card', 2)).toBe('карты')
      expect(plural('dialogs', 'viewer_card', 5)).toBe('карт')
      expect(plural('lobby', 'tournament_player', 3)).toBe('игрока')
      expect(plural('lobby', 'tournament_player', 22)).toBe('игрока')
      expect(plural('game', 'feed_events', 1)).toBe('1 событие')
      expect(plural('game', 'feed_events', 2)).toBe('2 события')
      expect(plural('game', 'feed_events', 5)).toBe('5 событий')
      expect(plural('game', 'feed_events', 21)).toBe('21 событие')
      expect(plural('lobby', 'online_count', 1)).toBe('игрок онлайн')
      expect(plural('lobby', 'online_count', 2)).toBe('игрока онлайн')
      expect(plural('lobby', 'online_count', 5)).toBe('игроков онлайн')
      expect(plural('lobby', 'match_replay', 1)).toBe('Смотреть повтор')
      expect(plural('lobby', 'match_replay', 3, { number: 2 })).toBe('Повтор И2')
    })
  })
})
