import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BOARD_WIPE_MIN, boardWipeDelay, boardWipeIds, clearBoardWipe, primeBoardWipe } from './boardWipe'
import { clearCardPositionRegistry, recordCardPosition } from './cardPositionRegistry'
import { WIPE_MS, WIPE_WAVE_LEAD, WIPE_WAVE_SPAN } from './impactFx'
import { makeGameView, makePermanent, makePlayer } from '../__fixtures__/gameViews'
import type { PermanentView } from '../net/types'

const rect = (left: number, top: number, width = 80, height = 112): DOMRect =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => {} } as DOMRect)

const bear = (id: string, extra: Partial<PermanentView> = {}) => makePermanent({ id, name: `Bear ${id}`, ...extra })

function field(ids: string[], extra: Partial<PermanentView> = {}): Record<string, PermanentView> {
  return Object.fromEntries(ids.map((id) => [id, bear(id, extra)]))
}

describe('boardWipeIds', () => {
  const me = makePlayer({ playerId: 'me', name: 'A', controlled: true, battlefield: field(['a', 'b']) })
  const opp = makePlayer({ playerId: 'o', name: 'B', battlefield: field(['c', 'd']) })
  const prev = makeGameView({ players: [me, opp] })

  it(`reads ${BOARD_WIPE_MIN} cards leaving every battlefield for a graveyard or exile as one wipe`, () => {
    const next = makeGameView({ players: [
      { ...me, battlefield: {}, graveyard: field(['a']), exile: field(['b']) },
      { ...opp, battlefield: {}, graveyard: field(['c', 'd']) },
    ] })
    expect(boardWipeIds(prev, next).sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('fewer cards is no wipe, and tokens ride along without counting', () => {
    const tokens = makeGameView({ players: [{ ...me, battlefield: { ...me.battlefield, t1: bear('t1', { isToken: true }), t2: bear('t2', { isToken: true }) } }, opp] })
    const three = makeGameView({ players: [
      { ...me, battlefield: {}, graveyard: field(['a', 'b']) },
      { ...opp, battlefield: field(['d']), graveyard: field(['c']) },
    ] })
    expect(boardWipeIds(tokens, three)).toEqual([])
    const four = makeGameView({ players: [
      { ...me, battlefield: {}, graveyard: field(['a', 'b']) },
      { ...opp, battlefield: {}, graveyard: field(['c', 'd']) },
    ] })
    expect(boardWipeIds(tokens, four).sort()).toEqual(['a', 'b', 'c', 'd', 't1', 't2'])
  })

  it('cards that went to a hand or to another battlefield are not taken', () => {
    const next = makeGameView({ players: [
      { ...me, battlefield: field(['c']), graveyard: field(['a']) },
      { ...opp, battlefield: {}, graveyard: field(['d']) },
    ], myHand: field(['b']) })
    expect(boardWipeIds(prev, next)).toEqual([])
  })

  it('combat deaths are never a wipe', () => {
    const fight = makeGameView({ players: [me, opp], combat: [{ attackers: field(['a', 'b']), blockers: field(['c', 'd']), defenderId: 'o' }] as never })
    const next = makeGameView({ players: [
      { ...me, battlefield: {}, graveyard: field(['a', 'b']) },
      { ...opp, battlefield: {}, graveyard: field(['c', 'd']) },
    ] })
    expect(boardWipeIds(fight, next)).toEqual([])
  })
})

describe('primeBoardWipe', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clearBoardWipe()
    clearCardPositionRegistry()
    document.body.innerHTML = '<div class="board-shell"></div>'
    vi.spyOn(document.querySelector('.board-shell')!, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 1000, 600))
  })

  afterEach(() => {
    vi.useRealTimers()
    clearBoardWipe()
    clearCardPositionRegistry()
  })

  it('times each death to the wave crossing it, left to right', () => {
    const ids = ['a', 'b', 'c', 'd']
    ids.forEach((id, i) => recordCardPosition(id, rect(i * 300 - 40, 100), 'player-zone'))
    const me = makePlayer({ playerId: 'me', name: 'A', battlefield: field(ids) })
    const next = makeGameView({ players: [{ ...me, battlefield: {}, graveyard: field(ids) }] })
    expect(primeBoardWipe(makeGameView({ players: [me] }), next).sort()).toEqual(ids)
    const delays = ids.map(boardWipeDelay)
    expect(delays[0]).toBe(Math.round(WIPE_MS * WIPE_WAVE_LEAD))
    expect(delays[3]).toBe(Math.round(WIPE_MS * (WIPE_WAVE_LEAD + 0.9 * WIPE_WAVE_SPAN)))
    expect([...delays].sort((x, y) => x - y)).toEqual(delays)
    vi.advanceTimersByTime(200)
    expect(boardWipeDelay('d')).toBe(delays[3] - 200)
    expect(boardWipeDelay('elsewhere')).toBe(0)
  })

  it('keeps the plan of the same wipe and plans nothing for an ordinary update', () => {
    const ids = ['a', 'b', 'c', 'd']
    const me = makePlayer({ playerId: 'me', name: 'A', battlefield: field(ids) })
    const prev = makeGameView({ players: [me] })
    const next = makeGameView({ players: [{ ...me, battlefield: {}, graveyard: field(ids) }] })
    primeBoardWipe(prev, next)
    vi.advanceTimersByTime(100)
    const before = boardWipeDelay('a')
    primeBoardWipe(prev, next)
    expect(boardWipeDelay('a')).toBe(before)
    expect(primeBoardWipe(prev, prev)).toEqual([])
  })
})
