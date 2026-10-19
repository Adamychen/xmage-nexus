// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import { getState, setState } from '../state/state'
import type { GameView } from '../net/types'
import { buildReplayFile, captureRewind, clearRewind, getRewind, parseReplayFile, viewedSnapshot } from './rewind'
import { leaveReplay, readReplayFile, startReplay } from './replayFile'

function view(turn: number, step: string): GameView {
  return { turn, step, players: [{ playerId: 'p1', name: 'Ana', life: 20 }] } as unknown as GameView
}

function record() {
  captureRewind('g1', view(1, 'UPKEEP'))
  captureRewind('g1', view(1, 'DRAW'))
  captureRewind('g1', view(2, 'UPKEEP'))
}

beforeEach(() => {
  clearRewind()
  setState({ phase: 'lobby', game: null, gameId: null })
})

describe('replay file', () => {
  it('needs at least two steps to be worth saving', () => {
    captureRewind('g1', view(1, 'UPKEEP'))
    expect(buildReplayFile()).toBeNull()
    captureRewind('g1', view(1, 'DRAW'))
    expect(buildReplayFile()?.snapshots).toHaveLength(2)
  })

  it('round-trips through JSON and through gzip', async () => {
    record()
    const file = buildReplayFile()!
    const json = JSON.stringify(file)
    expect(parseReplayFile(JSON.parse(json))?.snapshots).toHaveLength(3)

    const packed = await new Response(new Response(json).body!.pipeThrough(new CompressionStream('gzip'))).blob()
    const back = await readReplayFile(packed)
    expect(back?.snapshots.map((s) => `${s.turn}:${s.step}`)).toEqual(['1:UPKEEP', '1:DRAW', '2:UPKEEP'])
    expect(await readReplayFile(new Blob([json]))).not.toBeNull()
  })

  it('refuses anything that is not a replay', async () => {
    expect(parseReplayFile(null)).toBeNull()
    expect(parseReplayFile({ format: 'other', version: 1, snapshots: [] })).toBeNull()
    expect(parseReplayFile({ format: 'nexus-replay', version: 2, snapshots: [] })).toBeNull()
    expect(parseReplayFile({ format: 'nexus-replay', version: 1, snapshots: [{ key: 'a' }] })).toBeNull()
    expect(await readReplayFile(new Blob(['not json']))).toBeNull()
    expect(await readReplayFile(new Blob([new Uint8Array([0x1f, 0x8b, 1, 2, 3])]))).toBeNull()
  })

  it('refuses duplicate keys and oversized files', () => {
    record()
    const file = buildReplayFile()!
    const dup = { ...file, snapshots: [file.snapshots[0], file.snapshots[0]] }
    expect(parseReplayFile(dup)).toBeNull()
    const huge = { ...file, snapshots: Array.from({ length: 400 }, (_, i) => ({ ...file.snapshots[0], key: `k${i}` })) }
    expect(parseReplayFile(huge)).toBeNull()
  })

  it('opens a replay read-only, ignores live captures and leaves cleanly', () => {
    record()
    const file = buildReplayFile()!
    clearRewind()
    startReplay(file)

    expect(getState().phase).toBe('game')
    expect(getState().gameId).toBeNull()
    expect(getRewind().replay).toBe(true)
    expect(viewedSnapshot(getRewind())?.step).toBe('UPKEEP')

    captureRewind('live', view(9, 'DRAW'))
    expect(getRewind().snapshots).toHaveLength(3)
    expect(buildReplayFile()).toBeNull()

    leaveReplay()
    expect(getState().phase).toBe('lobby')
    expect(getState().game).toBeNull()
    expect(getRewind().replay).toBe(false)
    expect(getRewind().snapshots).toHaveLength(0)
  })
})
