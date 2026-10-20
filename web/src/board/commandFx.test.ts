import { afterEach, describe, expect, it, vi } from 'vitest'
import { castFromCommand, clearCommandReturns, commandReturnSource, commanderReturns, primeCommandReturns } from './commandFx'
import { makeCard, makeGameView, makePermanent, makePlayer } from '../__fixtures__/gameViews'
import type { CardView, GameView, PlayerView } from '../net/types'
import recorded from '../../fixtures/recorded/commander-zone.json'

const frame = (recorded as unknown as { gameView: GameView }).gameView
const me = (g: GameView) => (g.players ?? []).find((p) => p.controlled)!
const krenko = (me(frame).commandList as unknown as CardView[])[0]

function withMe(game: GameView, fn: (p: PlayerView) => PlayerView): GameView {
  return { ...game, players: (game.players ?? []).map((p) => (p.controlled ? fn(p) : p)) }
}

/** The recorded frame with Krenko moved from the command zone into `zone` under the same id. */
function krenkoIn(zone: 'battlefield' | 'graveyard' | 'exile'): GameView {
  return withMe(frame, (p) => ({ ...p, commandList: [], [zone]: { ...p[zone], [krenko.id!]: { ...krenko, mageObjectType: 'PERMANENT' } } }))
}

describe('commanderReturns', () => {
  it('reads the recorded commander back in the command zone, from the battlefield, its graveyard or exile', () => {
    for (const origin of ['battlefield', 'graveyard', 'exile'] as const) {
      const returns = commanderReturns(krenkoIn(origin), frame)
      expect(returns.map((r) => [r.id, r.origin, r.playerId]), origin).toEqual([[krenko.id, origin, me(frame).playerId]])
    }
  })

  it('reads a commander from my hand, but not one coming back from a hidden zone', () => {
    const inHand = { ...withMe(frame, (p) => ({ ...p, commandList: [] })), myHand: { [krenko.id!]: krenko } }
    expect(commanderReturns(inHand, frame).map((r) => r.origin)).toEqual(['hand'])
    expect(commanderReturns(withMe(frame, (p) => ({ ...p, commandList: [] })), frame)).toEqual([])
  })

  it('ignores a commander that stayed, emblems and a game start', () => {
    expect(commanderReturns(frame, frame)).toEqual([])
    const emblem = { id: 'emblem-1', name: 'Emblem Gideon', rules: ['x'] }
    const withEmblem = withMe(frame, (p) => ({ ...p, commandList: [...(p.commandList ?? []), emblem] as PlayerView['commandList'] }))
    expect(commanderReturns(frame, withEmblem)).toEqual([])
    expect(commanderReturns(null, frame)).toEqual([])
  })
})

describe('castFromCommand', () => {
  const cmd = makeCard({ id: 'cmd', name: 'Krenko, Mob Boss', cardTypes: ['CREATURE'], superTypes: ['LEGENDARY'], mageObjectType: 'COMMANDER' })
  const alice = (commandList: CardView[]) => makePlayer({ playerId: 'p1', name: 'Alice', commandList: commandList as PlayerView['commandList'] })

  it('matches the spell to the commander that left the command zone, by id or by name', () => {
    const prev = makeGameView({ players: [alice([cmd])] })
    const next = makeGameView({ players: [alice([])] })
    const byName = makeCard({ id: 'spell-ability-id', name: 'Krenko, Mob Boss', controllerId: 'p1' })
    expect(castFromCommand(byName, 'spell-ability-id', prev, next)).toBe('cmd')
    expect(castFromCommand(makeCard({ id: 'cmd', name: 'Other', controllerId: 'p1' }), 'cmd', prev, next)).toBe('cmd')
  })

  it('is null for a spell from the hand, an ability, or a commander still in the zone', () => {
    const prev = makeGameView({ players: [alice([cmd])] })
    const stayed = makeGameView({ players: [alice([cmd])] })
    const spell = makeCard({ id: 's', name: 'Krenko, Mob Boss', controllerId: 'p1' })
    expect(castFromCommand(spell, 's', prev, stayed)).toBeNull()
    expect(castFromCommand(makeCard({ id: 's', name: 'Lightning Bolt', controllerId: 'p1' }), 's', prev, makeGameView({ players: [alice([])] }))).toBeNull()
    expect(castFromCommand({ ...spell, isAbility: true }, 's', prev, makeGameView({ players: [alice([])] }))).toBeNull()
  })
})

describe('primeCommandReturns', () => {
  afterEach(() => {
    clearCommandReturns()
    document.body.innerHTML = ''
  })

  it('remembers where the commander was drawn in the view still on screen', () => {
    const playerId = me(frame).playerId
    document.body.innerHTML = `
      <div data-player-id="${playerId}">
        <div class="graveyard-chip"></div>
        <div class="creatures-band"><div class="card-slot" data-card-id="${krenko.id}"></div></div>
      </div>`
    const slot = document.querySelector('.card-slot')!
    const rect = { left: 300, top: 400, width: 90, height: 126, right: 390, bottom: 526, x: 300, y: 400, toJSON: () => {} } as DOMRect
    vi.spyOn(slot, 'getBoundingClientRect').mockReturnValue(rect)
    primeCommandReturns(krenkoIn('battlefield'), frame)
    expect(commandReturnSource(krenko.id)?.rect).toEqual(rect)

    clearCommandReturns()
    const chip = document.querySelector('.graveyard-chip')!
    vi.spyOn(chip, 'getBoundingClientRect').mockReturnValue({ ...rect, width: 120, height: 40 })
    primeCommandReturns(krenkoIn('graveyard'), frame)
    expect(commandReturnSource(krenko.id)?.size).toEqual({ w: 44, h: 62 })
    expect(commandReturnSource('someone-else')).toBeNull()
  })

  it('keeps nothing for a permanent that is not a commander', () => {
    const bear = makePermanent({ id: 'bear', name: 'Grizzly Bears' })
    const prev = makeGameView({ players: [makePlayer({ playerId: 'p1', name: 'Alice', battlefield: { bear } })] })
    primeCommandReturns(prev, makeGameView({ players: [makePlayer({ playerId: 'p1', name: 'Alice' })] }))
    expect(commandReturnSource('bear')).toBeNull()
  })
})
