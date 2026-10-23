import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { gameViewSchema } from '../../fixtures/schema'
import type { GameView } from '../net/types'
import { findDuplicateOwnership, checkZoneCounts } from './gameInvariants'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RECORDED_DIR = path.join(__dirname, '..', '..', 'fixtures', 'recorded')

function recordedFrames(): Array<{ file: string; view: GameView }> {
  const files = fs
    .readdirSync(RECORDED_DIR)
    .filter((f) => f.endsWith('.json') && f !== 'manifest.json')
    .sort()
  return files.flatMap((file) => {
    const raw = JSON.parse(fs.readFileSync(path.join(RECORDED_DIR, file), 'utf8'))
    if (!raw.gameView || typeof raw.gameView !== 'object') return []
    const view = gameViewSchema.parse(raw.gameView) as unknown as GameView
    return [{ file, view }]
  })
}

function clone<T>(v: T): T {
  return structuredClone(v) as T
}

describe('game invariants over recorded frames', () => {
  const frames = recordedFrames()

  it('TST-1: no object id is owned in two zones in any recorded frame', () => {
    const offenders: string[] = []
    for (const { file, view } of frames) {
      const dups = findDuplicateOwnership(view)
      if (dups.length > 0) {
        offenders.push(`${file}: ${dups.map((d) => `${d.id.slice(0, 8)} in ${d.zone}`).join(', ')}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('TST-2: visible zone counts match the report in every recorded frame', () => {
    const offenders: string[] = []
    for (const { file, view } of frames) {
      const mismatches = checkZoneCounts(view)
      if (mismatches.length > 0) {
        offenders.push(`${file}: ${mismatches.map((m) => `${m.player}.${m.zone} reported=${m.reported} visible=${m.visible}`).join(', ')}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('TST-6: the ownership guard fails when an id is duplicated across zones (fail mode)', () => {
    const frame = frames[0]
    const view = clone(frame.view)
    const victim = view.players![0]
    const other = view.players![1]
    const pid = Object.keys(victim.battlefield)[0]
    expect(pid).toBeTruthy()
    other.graveyard[pid] = victim.battlefield[pid]
    const dups = findDuplicateOwnership(view)
    expect(dups.some((d) => d.id === pid)).toBe(true)
  })

  it('TST-6: the count guard fails when a reported hand count is corrupted (fail mode)', () => {
    const frame = frames[0]
    const view = clone(frame.view)
    const self = view.players!.find((p) => p.playerId === view.myPlayerId) ?? view.players![0]
    self.handCount = (self.handCount ?? 0) + 1
    const mismatches = checkZoneCounts(view)
    expect(mismatches.some((m) => m.zone === 'hand')).toBe(true)
  })
})
