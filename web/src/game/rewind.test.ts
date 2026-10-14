import { beforeEach, describe, expect, it } from 'vitest'
import type { GameView } from '../net/types'
import {
  MAX_REWIND_SNAPSHOTS,
  captureRewind,
  clearRewind,
  getRewind,
  stepRewind,
  viewRewind,
  viewedSnapshot,
} from './rewind'

function view(turn: number, step: string, marker = ''): GameView {
  return { turn, step, marker } as unknown as GameView
}

beforeEach(() => clearRewind())

describe('rewind snapshots', () => {
  it('keeps one snapshot per step and replaces it while the step lasts', () => {
    captureRewind('g1', view(1, 'UPKEEP', 'a'))
    captureRewind('g1', view(1, 'UPKEEP', 'b'))
    captureRewind('g1', view(1, 'DRAW'))
    const { snapshots } = getRewind()
    expect(snapshots.map((s) => `${s.turn}:${s.step}`)).toEqual(['1:UPKEEP', '1:DRAW'])
    expect((snapshots[0].game as unknown as { marker: string }).marker).toBe('b')
  })

  it('records a step that comes back later in the turn as a new snapshot', () => {
    captureRewind('g1', view(2, 'PRECOMBAT_MAIN'))
    captureRewind('g1', view(2, 'BEGIN_COMBAT'))
    captureRewind('g1', view(2, 'PRECOMBAT_MAIN'))
    const keys = getRewind().snapshots.map((s) => s.key)
    expect(new Set(keys).size).toBe(3)
  })

  it('starts over when another game begins', () => {
    captureRewind('g1', view(3, 'DRAW'))
    captureRewind('g2', view(1, 'UPKEEP'))
    expect(getRewind().gameId).toBe('g2')
    expect(getRewind().snapshots).toHaveLength(1)
  })

  it('drops the snapshots a rollback made untrue', () => {
    captureRewind('g1', view(2, 'DRAW'))
    captureRewind('g1', view(3, 'DRAW'))
    captureRewind('g1', view(4, 'DRAW'))
    captureRewind('g1', view(3, 'UPKEEP'))
    expect(getRewind().snapshots.map((s) => s.turn)).toEqual([2, 3, 3])
  })

  it('is bounded', () => {
    for (let i = 1; i <= MAX_REWIND_SNAPSHOTS + 15; i++) captureRewind('g1', view(i, 'DRAW'))
    const { snapshots } = getRewind()
    expect(snapshots).toHaveLength(MAX_REWIND_SNAPSHOTS)
    expect(snapshots[snapshots.length - 1].turn).toBe(MAX_REWIND_SNAPSHOTS + 15)
  })

  it('ignores views without a turn', () => {
    captureRewind('g1', null)
    captureRewind('g1', {} as GameView)
    expect(getRewind().snapshots).toHaveLength(0)
  })
})

describe('rewind viewing', () => {
  it('keeps showing the chosen snapshot while live views keep arriving', () => {
    captureRewind('g1', view(1, 'UPKEEP'))
    captureRewind('g1', view(1, 'DRAW'))
    const first = getRewind().snapshots[0].key
    viewRewind(first)
    captureRewind('g1', view(2, 'UPKEEP'))
    expect(viewedSnapshot(getRewind())?.key).toBe(first)
  })

  it('moves to the oldest snapshot left when the viewed one is evicted', () => {
    captureRewind('g1', view(1, 'DRAW'))
    viewRewind(getRewind().snapshots[0].key)
    for (let i = 2; i <= MAX_REWIND_SNAPSHOTS + 5; i++) captureRewind('g1', view(i, 'DRAW'))
    const viewed = viewedSnapshot(getRewind())
    expect(viewed).not.toBeNull()
    expect(viewed?.key).toBe(getRewind().snapshots[0].key)
  })

  it('steps within bounds and ignores unknown keys', () => {
    captureRewind('g1', view(1, 'UPKEEP'))
    captureRewind('g1', view(1, 'DRAW'))
    captureRewind('g1', view(1, 'PRECOMBAT_MAIN'))
    stepRewind(-1)
    expect(viewedSnapshot(getRewind())?.step).toBe('DRAW')
    stepRewind(-5)
    expect(viewedSnapshot(getRewind())?.step).toBe('UPKEEP')
    viewRewind('nope')
    expect(viewedSnapshot(getRewind())?.step).toBe('UPKEEP')
    viewRewind(null)
    expect(getRewind().viewing).toBeNull()
  })
})
