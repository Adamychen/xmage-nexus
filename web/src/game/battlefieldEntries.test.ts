import { beforeEach, describe, expect, it } from 'vitest'
import { observeBattlefieldEntries, resetBattlefieldEntries, sameEntries } from './battlefieldEntries'
import { makeGameView, makePermanent, makePlayer } from '../__fixtures__/gameViews'
import type { PermanentView } from '../net/types'

const perm = (id: string) => makePermanent({ id, name: id })

function view(turn: number, mine: Record<string, PermanentView>, theirs: Record<string, PermanentView> = {}) {
  return makeGameView({
    turn,
    players: [
      makePlayer({ playerId: 'me', name: 'Me', controlled: true, battlefield: mine }),
      makePlayer({ playerId: 'op', name: 'Op', battlefield: theirs }),
    ],
  })
}

describe('battlefieldEntries', () => {
  beforeEach(() => resetBattlefieldEntries(null))

  it('marks arrivals of the current turn for every player and expires them next turn', () => {
    const v1 = view(1, { a: perm('a') })
    expect(observeBattlefieldEntries(null, v1, 'g')).toEqual({})
    const v2 = view(1, { a: perm('a'), b: perm('b') }, { t: perm('t') })
    expect(observeBattlefieldEntries(v1, v2, 'g')).toEqual({ b: true, t: true })
    const v3 = view(2, { a: perm('a'), b: perm('b') }, { t: perm('t') })
    expect(observeBattlefieldEntries(v2, v3, 'g')).toEqual({})
  })

  it('forgets permanents that leave and re-marks them when they come back', () => {
    const v1 = view(1, { a: perm('a') })
    observeBattlefieldEntries(null, v1, 'g')
    const v2 = view(3, {})
    observeBattlefieldEntries(v1, v2, 'g')
    expect(observeBattlefieldEntries(v2, view(3, { a: perm('a') }), 'g')).toEqual({ a: true })
  })

  it('does not guess on the first frame of a new game', () => {
    observeBattlefieldEntries(null, view(1, {}), 'g')
    expect(observeBattlefieldEntries(null, view(5, { z: perm('z') }), 'other')).toEqual({})
  })

  it('compares entry sets', () => {
    expect(sameEntries({ a: true }, { a: true })).toBe(true)
    expect(sameEntries({ a: true }, { b: true })).toBe(false)
    expect(sameEntries({}, { b: true })).toBe(false)
  })
})
