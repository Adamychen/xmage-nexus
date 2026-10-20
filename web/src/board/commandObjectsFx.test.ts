import { describe, expect, it } from 'vitest'
import { commandArrivals, dungeonOf } from './commandObjectsFx'
import { makeGameView, makePlayer } from '../__fixtures__/gameViews'
import emblemFrame from '../../fixtures/recorded/emblem.json'
import dungeonFrame from '../../fixtures/recorded/dungeon.json'
import type { GameView } from '../net/types'

const recordedEntry = (frame: unknown, match: string) => ((frame as { gameView: GameView }).gameView.players ?? [])
  .flatMap((p) => (p.commandList ?? []) as Array<Record<string, unknown>>)
  .find((c) => String(c.name ?? '').includes(match))!

describe('commandArrivals', () => {
  it('reads a new emblem in the shape the server sends (an EmblemView with no type)', () => {
    const emblem = recordedEntry(emblemFrame, 'Emblem')
    const prev = makeGameView({ players: [makePlayer({ playerId: 'me', name: 'A', commandList: [] })] })
    const next = makeGameView({ players: [makePlayer({ playerId: 'me', name: 'A', commandList: [emblem] })] })
    expect(commandArrivals(prev, next).emblems.map((e) => e.id)).toEqual([emblem.id])
    expect(commandArrivals(next, next).emblems).toHaveLength(0)
  })

  it('reads the current dungeon room from its rules and reports a room advance', () => {
    const dungeon = recordedEntry(dungeonFrame, 'Phandelver')
    const me = makePlayer({ playerId: 'me', name: 'A', commandList: [dungeon] })
    expect(dungeonOf(me)?.room).toBe('Goblin Lair')
    const earlier = { ...dungeon, rules: (dungeon.rules as string[]).map((r) => r.replace('Currently in Goblin Lair', 'Currently in Cave Entrance')) }
    const prev = makeGameView({ players: [{ ...me, commandList: [earlier] }] })
    const next = makeGameView({ players: [me] })
    expect(commandArrivals(prev, next).dungeons).toEqual([{ playerId: 'me', dungeon: expect.objectContaining({ room: 'Goblin Lair' }), entered: false }])
    const none = makeGameView({ players: [{ ...me, commandList: [] }] })
    expect(commandArrivals(none, next).dungeons.map((d) => d.entered)).toEqual([true])
  })

  it('reports a planeswalk once, though every player carries the plane', () => {
    const plane = (id: string, name: string) => ({ id, name, expansionSetCode: 'PCA', rules: [] })
    const seat = (id: string, list: unknown[]) => makePlayer({ playerId: id, name: id, commandList: list })
    const prev = makeGameView({ players: [seat('a', [plane('p1', 'Plane - Akoum')]), seat('b', [plane('p1', 'Plane - Akoum')])] })
    const next = makeGameView({ players: [seat('a', [plane('p2', 'Plane - Academy at Tolaria West')]), seat('b', [plane('p2', 'Plane - Academy at Tolaria West')])] })
    expect(commandArrivals(prev, next).planes).toEqual([expect.objectContaining({ id: 'p2', replaced: true })])
  })
})
