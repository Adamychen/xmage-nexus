import { describe, expect, it } from 'vitest'
import { dayNightHintOf, dayNightStateOf, dayNightStateOfPlayer } from './dayNight'
import { makeCard, makeGameView, makePermanent, makePlayer } from '../__fixtures__/gameViews'
import type { GameView } from '../net/types'
import dayNightFrame from '../../fixtures/recorded/day-night.json'
import failToFindFrame from '../../fixtures/recorded/fail-to-find.json'

const NIGHT_HINT =
  "It's currently night, active player has cast 0 spells this turn. It will not become day next turn."
const DAY_HINT =
  "It's currently day, active player has cast 3 spells this turn. It will not become night next turn."
const NEITHER_HINT = "It's neither day nor night."

const NIGHTBOUND_RULE =
  'Nightbound <i>(If a player casts at least two spells during their own turn, it becomes day next turn.)</i>'
const DAYBOUND_RULE =
  'Daybound <i>(If a player casts no spells during their own turn, it becomes night next turn.)</i>'

function gameWith(partial: Partial<GameView>): GameView {
  return makeGameView(partial)
}

describe('dayNightHintOf', () => {
  it('parses the night hint from the recorded day-night frame', () => {
    const gv = (dayNightFrame as unknown as { gameView: GameView }).gameView
    const transformed = Object.values(gv.players?.[0]?.battlefield ?? {}).find((c) => c.transformed)
    expect(dayNightHintOf(transformed?.rules)).toEqual({ isNight: true, hint: NIGHT_HINT })
  })

  it('returns null for the neither hint recorded in fail-to-find', () => {
    const gv = (failToFindFrame as unknown as { gameView: GameView }).gameView
    const helper = Object.values(gv.myHelperEmblems ?? {}).find((c) =>
      (c.rules ?? []).includes(NEITHER_HINT),
    )
    expect(helper).toBeDefined()
    expect(dayNightHintOf(helper?.rules)).toBeNull()
  })

  it('ignores the static Daybound / Nightbound rules lines', () => {
    expect(dayNightHintOf([NIGHTBOUND_RULE])).toBeNull()
    expect(dayNightHintOf([DAYBOUND_RULE])).toBeNull()
    expect(dayNightHintOf([NIGHTBOUND_RULE, '<br/><hintstart/>'])).toBeNull()
  })

  it('parses the day hint and strips html', () => {
    const rules = ['<br/><hintstart/>', `<font color = 'blue'>${DAY_HINT}</font>`]
    expect(dayNightHintOf(rules)).toEqual({ isNight: false, hint: DAY_HINT })
  })

  it('returns null without rules or without a day/night line', () => {
    expect(dayNightHintOf(undefined)).toBeNull()
    expect(dayNightHintOf(null)).toBeNull()
    expect(dayNightHintOf([])).toBeNull()
    expect(dayNightHintOf(['Flying, deathtouch, trample, haste'])).toBeNull()
  })
})

describe('dayNightStateOf', () => {
  it('reads the helper emblem hint for the active player', () => {
    const game = gameWith({
      myHelperEmblems: {
        helper: makeCard({ name: 'Helper Emblem', rules: ['Day or night.', '<br/><hintstart/>', NIGHT_HINT] }),
      },
      players: [],
    })
    expect(dayNightStateOf(game)).toEqual({ isNight: true, hint: NIGHT_HINT })
  })

  it('returns null when the helper emblem says neither day nor night', () => {
    const game = gameWith({
      myHelperEmblems: {
        helper: makeCard({ name: 'Helper Emblem', rules: ['Day or night.', '<br/><hintstart/>', NEITHER_HINT] }),
      },
      players: [],
    })
    expect(dayNightStateOf(game)).toBeNull()
  })

  it('falls back to battlefield rules for a spectator (no helper emblems)', () => {
    const game = gameWith({
      myHelperEmblems: {},
      players: [
        makePlayer({
          playerId: 'p1',
          name: 'Werewolf Player',
          battlefield: {
            werewolf: makePermanent({ name: 'Storm-Charged Slasher', parentId: 'werewolf', rules: [NIGHTBOUND_RULE, '<br/><hintstart/>', NIGHT_HINT] }),
          },
        }),
      ],
    })
    expect(dayNightStateOf(game)).toEqual({ isNight: true, hint: NIGHT_HINT })
  })

  it('reads the hint from the second card face', () => {
    const game = gameWith({
      players: [
        makePlayer({
          playerId: 'p1',
          name: 'Werewolf Player',
          battlefield: {
            werewolf: makePermanent({
              name: 'Storm-Charged Slasher',
              parentId: 'werewolf',
              rules: ['At the beginning of combat on your turn, target creature you control gets +2/+0.'],
              secondCardFace: makeCard({ name: 'Reckless Stormseeker', rules: [DAYBOUND_RULE, DAY_HINT] }),
            }),
          },
        }),
      ],
    })
    expect(dayNightStateOf(game)).toEqual({ isNight: false, hint: DAY_HINT })
  })

  it('returns null without a game or without a real hint', () => {
    expect(dayNightStateOf(null)).toBeNull()
    expect(dayNightStateOf(gameWith({ players: [makePlayer({ playerId: 'p1', name: 'Alice' })] }))).toBeNull()
  })
})

describe('dayNightStateOfPlayer', () => {
  const werewolfPlayer = makePlayer({
    playerId: 'p1',
    name: 'Werewolf Player',
    battlefield: {
      werewolf: makePermanent({ name: 'Storm-Charged Slasher', parentId: 'werewolf', rules: [NIGHT_HINT] }),
    },
  })

  it('reads the helper emblem for the controlled player', () => {
    const controlled = makePlayer({ playerId: 'me', name: 'Me', controlled: true })
    const game = gameWith({
      myHelperEmblems: { helper: makeCard({ name: 'Helper Emblem', rules: [NIGHT_HINT] }) },
      players: [controlled],
    })
    expect(dayNightStateOfPlayer(controlled, game)).toEqual({ isNight: true, hint: NIGHT_HINT })
  })

  it('scopes the battlefield fallback to the player owning the day/night source', () => {
    const other = makePlayer({ playerId: 'p2', name: 'Other' })
    const game = gameWith({ myHelperEmblems: {}, players: [werewolfPlayer, other] })
    expect(dayNightStateOfPlayer(werewolfPlayer, game)).toEqual({ isNight: true, hint: NIGHT_HINT })
    expect(dayNightStateOfPlayer(other, game)).toBeNull()
    expect(dayNightStateOfPlayer(null, game)).toBeNull()
  })
})
