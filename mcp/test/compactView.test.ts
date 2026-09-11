import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { GameView } from '../../web/src/net/types.generated.ts'
import { compactGameView } from '../src/xmage/compactView.ts'

const recordedDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'web', 'fixtures', 'recorded')

function loadGameView(name: string): GameView {
  const frame = JSON.parse(fs.readFileSync(path.join(recordedDir, `${name}.json`), 'utf8')) as { gameView: GameView }
  return frame.gameView
}

describe('compactGameView', () => {
  it('compacts a real frame without leaking card rules', () => {
    const game = loadGameView('creature')
    const compact = compactGameView(game)
    const battlefieldTotal = (game.players ?? []).reduce(
      (acc, player) => acc + Object.keys(player.battlefield ?? {}).length,
      0,
    )
    expect(compact.hand.length).toBe(Object.keys(game.myHand).length)
    expect(compact.battlefield.mine.length + compact.battlefield.theirs.length).toBe(battlefieldTotal)
    expect(compact.stack.length).toBe(Object.keys(game.stack).length)
    expect(compact.me?.life).toBe(game.players?.find((player) => player.controlled)?.life)
    expect(Array.isArray(compact.playableIds)).toBe(true)
    const serialized = JSON.stringify(compact)
    expect(serialized).not.toContain('"rules"')
    expect(serialized.length).toBeLessThan(8_000)
  })

  it('exposes combat attackers from a real combat frame', () => {
    const compact = compactGameView(loadGameView('combat'))
    expect(compact.combat.attackers.length).toBeGreaterThan(0)
  })
})
