import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  chooseMainSeat,
  choiceForGame,
  declarationKey,
  mainSeatId,
  panelSeatIds,
  spotlightActive,
  useSpotlight,
  type SpotlightChoice,
} from './spotlight'
import { getState, setState } from '../state/state'
import { spectatorHomeSeat } from './boardShared'
import type { PlayerView } from '../net/types'

const ME = 'p1'
const LIVE = ['p2', 'p3', 'p4']
const SEATS = ['p1', 'p2', 'p3', 'p4']

function main(chosen: SpotlightChoice | null, declaration: string | null = null, liveOppIds: readonly string[] = LIVE): string {
  return mainSeatId({ chosen, homeId: ME, liveOppIds, declaration })
}

describe('spotlight', () => {
  it('BRD-6: the main board mode needs the switch, an Arena or Table layout, a player seat and two live opponents', () => {
    const on = { enabled: true, arenaLayout: true, isSpectator: false, liveOppCount: 2 }
    expect(spotlightActive(on)).toBe(true)
    expect(spotlightActive({ ...on, enabled: false })).toBe(false)
    expect(spotlightActive({ ...on, arenaLayout: false })).toBe(false)
    expect(spotlightActive({ ...on, liveOppCount: 1 })).toBe(false)
  })

  it('BRD-6: a spectator gets the main board mode with three or more players left, not with two', () => {
    const on = { enabled: true, arenaLayout: true, isSpectator: true, liveOppCount: 3 }
    expect(spotlightActive(on)).toBe(true)
    expect(spotlightActive({ ...on, liveOppCount: 4 })).toBe(true)
    expect(spotlightActive({ ...on, liveOppCount: 2 })).toBe(false)
    expect(spotlightActive({ ...on, enabled: false })).toBe(false)
    expect(spotlightActive({ ...on, arenaLayout: false })).toBe(false)
  })

  it('BRD-7: a spectator starts on the seat the column view draws at the bottom and falls back to it when the chosen seat leaves', () => {
    const seat = (playerId: string) => ({ playerId, name: playerId } as PlayerView)
    expect(spectatorHomeSeat([seat('p1'), seat('p2'), seat('p3'), seat('p4')])?.playerId).toBe('p4')
    expect(spectatorHomeSeat([seat('p1')])?.playerId).toBe('p1')
    const live = ['p1', 'p2', 'p4']
    const home = 'p4'
    expect(mainSeatId({ chosen: null, homeId: home, liveOppIds: live, declaration: null })).toBe('p4')
    expect(mainSeatId({ chosen: { playerId: 'p2', pickedIn: null }, homeId: home, liveOppIds: live, declaration: null })).toBe('p2')
    expect(mainSeatId({ chosen: { playerId: 'p3', pickedIn: null }, homeId: home, liveOppIds: live, declaration: null })).toBe('p4')
  })

  it('BRD-6: a spectator\'s panel lists every other seat in turn order after the home seat', () => {
    expect(panelSeatIds(SEATS, 'p3', 'p3')).toEqual(['p4', 'p1', 'p2'])
    expect(panelSeatIds(SEATS, 'p3', 'p1')).toEqual(['p4', 'p2', 'p3'])
    expect(panelSeatIds(SEATS, 'p1', 'p2')).toEqual(['p3', 'p4', 'p1'])
  })

  it('BRD-6: the panel lists every other seat in turn order after the player, the own seat last when it is not main', () => {
    expect(panelSeatIds(SEATS, ME, ME)).toEqual(['p2', 'p3', 'p4'])
    expect(panelSeatIds(SEATS, ME, 'p3')).toEqual(['p2', 'p4', 'p1'])
    expect(panelSeatIds(['p2', 'p3', 'p1'], 'p3', 'p2')).toEqual(['p1', 'p3'])
  })

  it('BRD-6: a defeated seat keeps its place in the panel', () => {
    const withDefeated = ['p1', 'p2', 'p3', 'p4']
    expect(panelSeatIds(withDefeated, ME, ME)).toContain('p2')
    expect(panelSeatIds(withDefeated, ME, ME)).toEqual(['p2', 'p3', 'p4'])
  })

  it('BRD-7: the own board is the main board until a seat is picked', () => {
    expect(main(null)).toBe(ME)
    expect(main(null, '2:attack')).toBe(ME)
  })

  it('BRD-7: clicking the own copy brings the own board back', () => {
    const picked = chooseMainSeat('p3', null)
    expect(main(picked)).toBe('p3')
    expect(main(chooseMainSeat(ME, null))).toBe(ME)
  })

  it('BRD-7: a picked opponent stays main until they leave or lose, then the own board comes back', () => {
    const picked: SpotlightChoice = { playerId: 'p3', pickedIn: null }
    expect(main(picked)).toBe('p3')
    expect(main(picked, null, ['p2', 'p4'])).toBe(ME)
  })

  it('BRD-7: a choice made in another game is ignored', () => {
    expect(choiceForGame({ gameId: 'g1', playerId: 'p3', pickedIn: null }, 'g2')).toBeNull()
    expect(choiceForGame({ gameId: 'g1', playerId: 'p3', pickedIn: null }, 'g1')).toEqual({ playerId: 'p3', pickedIn: null })
    expect(main(choiceForGame({ gameId: 'g1', playerId: 'p3', pickedIn: null }, 'g2'))).toBe(ME)
  })

  it('BRD-9: an attackers or blockers declaration puts the own board in the main area and the chosen board comes back after it', () => {
    const picked: SpotlightChoice = { playerId: 'p3', pickedIn: null }
    const declaration = declarationKey(4, 'block')
    expect(main(picked, declaration)).toBe(ME)
    expect(main(picked, null)).toBe('p3')
  })

  it('BRD-9: a seat picked during the declaration stays after the declaration ends', () => {
    const declaration = declarationKey(4, 'attack')
    const picked = chooseMainSeat('p4', declaration)
    expect(main(picked, declaration)).toBe('p4')
    expect(main(picked, null)).toBe('p4')
  })

  it('BRD-9: a seat picked during an earlier declaration does not survive the next one', () => {
    const picked = chooseMainSeat('p4', declarationKey(4, 'attack'))
    expect(main(picked, declarationKey(5, 'attack'))).toBe(ME)
  })

  describe('useSpotlight', () => {
    beforeEach(() => {
      setState({ gameId: 'g1', spotlight: null } as never)
    })

    it('BRD-7: useSpotlight stores the pick for the current game and returns it as the main seat', () => {
      const { result } = renderHook(() => useSpotlight(null, ME, LIVE, null))
      expect(result.current.mainId).toBe(ME)
      act(() => result.current.select('p3'))
      expect(getState().spotlight).toEqual({ gameId: 'g1', playerId: 'p3', pickedIn: null })
      expect(result.current.mainId).toBe('p3')
    })
  })
})
