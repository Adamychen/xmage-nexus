import { afterEach, describe, expect, it } from 'vitest'
import {
  commanderDamageDealt,
  commanderPlaysCount,
  commanderTax,
  commandersOf,
  hasCommanders,
  resetCommanderMemory,
  syncCommanderMemory,
} from './commanders'
import { commanderDamageRule, commanderInfoRule, makeCard, makeGameView, makePermanent, makePlayer } from '../__fixtures__/gameViews'
import type { CardView, GameView } from '../net/types'
import commanderZoneFrame from '../../fixtures/recorded/commander-zone.json'
import commanderPodFrame from '../../fixtures/recorded/commander-4.json'

function playsPerPlayer(frame: unknown): number[] {
  const gv = (frame as { gameView: GameView }).gameView
  return (gv.players ?? []).map((p) => commandersOf(p)[0]?.castCount ?? -1)
}

describe('commanderPlaysCount', () => {
  it('reads the count the server writes into the commander rules', () => {
    expect(playsPerPlayer(commanderZoneFrame)).toEqual([0, 2])
    expect(playsPerPlayer(commanderPodFrame)).toEqual([0, 0, 0, 1])
  })

  it('turns the recorded counts into the commander tax', () => {
    const gv = (commanderZoneFrame as unknown as { gameView: GameView }).gameView
    expect(commanderTax(commandersOf(gv.players?.[1])[0].castCount)).toBe(4)
  })

  it('ignores the commander damage lines that share the same prefix', () => {
    const rules = ["<b>Commander</b> did 3 combat damage to player <font color='#20B2AA'>sim</font>."]
    expect(commanderPlaysCount({ rules })).toBe(0)
  })

  it('matches the singular and plural sentences of the engine', () => {
    expect(commanderPlaysCount({ rules: [commanderInfoRule(1)] })).toBe(1)
    expect(commanderPlaysCount({ rules: [commanderInfoRule(5)] })).toBe(5)
    expect(commanderPlaysCount({ rules: [commanderInfoRule(0)] })).toBe(0)
    expect(commanderPlaysCount({})).toBe(0)
  })
})

/** Every (commander, target) pair of a frame that reports damage. */
function damagePairs(gv: GameView): string[] {
  const commanders = (gv.players ?? []).flatMap((p) => commandersOf(p).map((c) => ({ owner: p.name, commander: c })))
  const pairs: string[] = []
  for (const target of gv.players ?? []) {
    for (const { owner, commander } of commanders) {
      const dmg = commanderDamageDealt(gv, commander, target)
      if (dmg > 0) pairs.push(`${commander.name} of ${owner} -> ${target.name}: ${dmg}`)
    }
  }
  return pairs
}

function commanderCard(id: string, name: string, rules: string[]): CardView {
  return makeCard({ id, name, mageObjectType: 'COMMANDER', rules: [commanderInfoRule(0), ...rules] })
}

describe('commander memory (game-scoped roster)', () => {
  afterEach(() => resetCommanderMemory())

  const bobView = () => makePlayer({ playerId: 'p2', name: 'Bob' })

  it('keeps the column, the owner and the damage while the commander is in an invisible zone', () => {
    // El daño viaja solo en las rules del objeto del comandante: si el objeto cae en una
    // zona invisible (mano rival, biblioteca), el roster vivo lo pierde entero. La memoria
    // de partida conserva la columna con la última card vista (sus rules traen el total,
    // que no puede crecer mientras el comandante no esté en campo de batalla).
    const alice = makePlayer({
      playerId: 'p1',
      name: 'Alice',
      commandList: [commanderCard('cmd-a', 'Krenko, Mob Boss', [commanderDamageRule(7, 'Bob')])],
    })
    const gv1 = makeGameView({ players: [alice, bobView()] })
    const seen = syncCommanderMemory(gv1)
    expect(seen.map((c) => c.name)).toEqual(['Krenko, Mob Boss'])
    expect(commanderDamageDealt(gv1, seen[0], bobView())).toBe(7)

    // Vista siguiente: el comandante no está en ninguna zona visible.
    const gv2 = makeGameView({ players: [makePlayer({ playerId: 'p1', name: 'Alice' }), bobView()] })
    const merged = syncCommanderMemory(gv2)
    expect(merged.map((c) => c.name)).toEqual(['Krenko, Mob Boss'])
    expect(merged[0].ownerName).toBe('Alice')
    expect(commanderDamageDealt(gv2, merged[0], bobView())).toBe(7)
    expect(hasCommanders(gv2)).toBe(true)
  })

  it('picks up the fresh totals when the commander becomes visible again', () => {
    const gv1 = makeGameView({
      players: [
        makePlayer({ playerId: 'p1', name: 'Alice', commandList: [commanderCard('cmd-a', 'Krenko, Mob Boss', [commanderDamageRule(7, 'Bob')])] }),
        bobView(),
      ],
    })
    syncCommanderMemory(gv1)
    const gv2 = makeGameView({
      players: [
        makePlayer({ playerId: 'p1', name: 'Alice', commandList: [commanderCard('cmd-a', 'Krenko, Mob Boss', [commanderDamageRule(12, 'Bob')])] }),
        bobView(),
      ],
    })
    const [cmd] = syncCommanderMemory(gv2)
    expect(commanderDamageDealt(gv2, cmd, bobView())).toBe(12)
  })

  it('starts from scratch when a new game begins (new player ids)', () => {
    const gv1 = makeGameView({
      players: [
        makePlayer({ playerId: 'p1', name: 'Alice', commandList: [commanderCard('cmd-a', 'Krenko, Mob Boss', [])] }),
        makePlayer({ playerId: 'p2', name: 'Bob' }),
      ],
    })
    expect(syncCommanderMemory(gv1).length).toBe(1)
    const gv2 = makeGameView({
      players: [makePlayer({ playerId: 'p9', name: 'Zoe' }), makePlayer({ playerId: 'p10', name: 'Wade' })],
    })
    expect(syncCommanderMemory(gv2)).toEqual([])
    expect(hasCommanders(gv2)).toBe(false)
  })

  it('keeps a commander that is also a companion (Lurrus): the watcher marker wins', () => {
    // parseCommandList marca isCompanion por el texto de las rules ("Companion —…") y ahí
    // fuerza isCommander=false: la matriz habría expulsado la columna del comandante.
    const lurrus = makeCard({
      id: 'cmd-l',
      name: 'Lurrus of the Dream-Den',
      mageObjectType: 'COMMANDER',
      rules: ['Companion — Your starting deck contains only cards with mana value 2 or less.', commanderInfoRule(0)],
    })
    const alice = makePlayer({ playerId: 'p1', name: 'Alice', commandList: [lurrus] })
    const [info] = commandersOf(alice)
    expect(info.isCompanion).toBe(true)
    expect(info.isCommander).toBe(true)
  })
})

describe('commanderDamageDealt hardening (wire formats beyond the recorded frame)', () => {
  afterEach(() => resetCommanderMemory())

  it('parses several damage sentences concatenated in one rules string', () => {
    // El motor escribe una entrada de info por jugador, pero un fork o una versión vieja
    // podría concatenarlas: el regex anclado a fin de frase perdía TODAS las frases menos
    // la última (y esa mal).
    const gv = makeGameView({
      players: [
        makePlayer({
          playerId: 'p1',
          name: 'Alice',
          commandList: [commanderCard('cmd-a', 'Krenko, Mob Boss', [`${commanderDamageRule(3, 'Bob')} ${commanderDamageRule(5, 'Carol')}`])],
        }),
        makePlayer({ playerId: 'p2', name: 'Bob' }),
        makePlayer({ playerId: 'p3', name: 'Carol' }),
      ],
    })
    const [krenko] = commandersOf(gv.players?.[0])
    expect(commanderDamageDealt(gv, krenko, gv.players![1])).toBe(3)
    expect(commanderDamageDealt(gv, krenko, gv.players![2])).toBe(5)
  })

  it('matches player names the server HTML-escaped', () => {
    const gv = makeGameView({
      players: [
        makePlayer({
          playerId: 'p1',
          name: 'Alice',
          commandList: [commanderCard('cmd-a', 'Krenko, Mob Boss', ["<b>Commander</b> did 4 combat damage to player <font color='#20B2AA'>O&#39;Neil &amp; Co</font>."])],
        }),
        makePlayer({ playerId: 'p2', name: "O'Neil & Co" }),
      ],
    })
    const [krenko] = commandersOf(gv.players?.[0])
    expect(commanderDamageDealt(gv, krenko, gv.players![1])).toBe(4)
  })
})

describe('commandersOf', () => {
  it('still reports a commander that has left the command zone', () => {
    // `PlayerView.commandList` is built from `game.getState().getCommand()`, which holds a
    // `Commander` object only while the card is IN the command zone: casting it runs
    // `CardImpl.removeFromZone(COMMAND)`, which drops that object. So the whole time a
    // commander is on the battlefield (the normal state) it is absent from commandList,
    // and a roster built only from there loses the player entirely.
    const gv = makeGameView({
      players: [
        makePlayer({
          playerId: 'p1',
          name: 'Alice',
          commandList: [],
          battlefield: {
            'perm-a': makePermanent({
              id: 'perm-a',
              name: 'Krenko, Mob Boss',
              rules: [commanderInfoRule(1), commanderDamageRule(7, 'Bob')],
            }),
          },
        }),
        makePlayer({ playerId: 'p2', name: 'Bob' }),
      ],
    })
    const [alice] = gv.players ?? []
    expect(commandersOf(alice).map((c) => c.name)).toEqual(['Krenko, Mob Boss'])
  })

  it('reports a commander that died and went to the graveyard', () => {
    const gv = makeGameView({
      players: [
        makePlayer({
          playerId: 'p1',
          name: 'Alice',
          commandList: [],
          graveyard: { 'g-1': makeCard({ id: 'g-1', name: 'Krenko, Mob Boss', rules: [commanderInfoRule(1), commanderDamageRule(4, 'Bob')] }) },
        }),
        makePlayer({ playerId: 'p2', name: 'Bob' }),
      ],
    })
    const [alice] = gv.players ?? []
    expect(commandersOf(alice).map((c) => c.name)).toEqual(['Krenko, Mob Boss'])
  })

  it('does not report a creature that is not a commander', () => {
    const gv = makeGameView({
      players: [
        makePlayer({
          playerId: 'p1',
          name: 'Alice',
          battlefield: { 'perm-x': makePermanent({ id: 'perm-x', name: 'Goblin Guide', rules: ['{T}: Add {R}.'] }) },
        }),
      ],
    })
    const [alice] = gv.players ?? []
    expect(commandersOf(alice)).toEqual([])
  })
})

describe('commanderDamageDealt', () => {
  it('reads the damage the recorded FFA frame reports', () => {
    const gv = (commanderPodFrame as unknown as { gameView: GameView }).gameView
    expect(damagePairs(gv)).toEqual(['Krenko, Mob Boss of ucomma1v7uk8l -> sim-137363: 3'])
  })

  it('does not invent damage from a counter or an unrelated rule line', () => {
    const gv = makeGameView({
      players: [
        makePlayer({
          playerId: 'p1',
          name: 'Alice',
          commandList: [commanderCard('cmd-a', 'Krenko, Mob Boss', ['<b>Commander</b> did 30 combat damage to player Bob.'])],
          counters: [{ name: 'Commander damage', count: 7 }],
        }),
        makePlayer({ playerId: 'p2', name: 'Bob', counters: [{ name: 'Commander damage', count: 7 }] }),
      ],
    })
    // The rule line names Bob, so only Bob reports it; player counters are not damage.
    expect(damagePairs(gv)).toEqual(['Krenko, Mob Boss of Alice -> Bob: 30'])
  })

  it('reads the permanent of a cast commander (same object id, not the same name)', () => {
    const gv = makeGameView({
      players: [
        makePlayer({
          playerId: 'p1',
          name: 'Alice',
          commandList: [commanderCard('cmd-a', 'Krenko, Mob Boss', [commanderDamageRule(7, 'Bob')])],
          battlefield: { 'cmd-a': makePermanent({ id: 'cmd-a', name: 'Krenko, Mob Boss', rules: [commanderDamageRule(7, 'Bob')] }) },
        }),
        makePlayer({ playerId: 'p2', name: 'Bob' }),
      ],
    })
    expect(damagePairs(gv)).toEqual(['Krenko, Mob Boss of Alice -> Bob: 7'])
  })

  it('keeps two commanders that share a name apart', () => {
    // Legal in Commander: two decks may run Krenko, and a commander only deals damage while
    // it is on the battlefield. Reading by name instead of by object used to report the
    // bigger of the two in both columns (15/15).
    const gv = makeGameView({
      players: [
        makePlayer({
          playerId: 'p1',
          name: 'Alice',
          commandList: [commanderCard('cmd-a', 'Krenko, Mob Boss', [commanderDamageRule(10, 'Carol')])],
          battlefield: { 'cmd-a': makePermanent({ id: 'cmd-a', name: 'Krenko, Mob Boss', rules: [commanderDamageRule(10, 'Carol')] }) },
        }),
        makePlayer({ playerId: 'p2', name: 'Carol' }),
        makePlayer({
          playerId: 'p3',
          name: 'Dave',
          commandList: [commanderCard('cmd-d', 'Krenko, Mob Boss', [commanderDamageRule(15, 'Carol')])],
          battlefield: { 'cmd-d': makePermanent({ id: 'cmd-d', name: 'Krenko, Mob Boss', rules: [commanderDamageRule(15, 'Carol')] }) },
        }),
      ],
    })
    expect(damagePairs(gv)).toEqual([
      'Krenko, Mob Boss of Alice -> Carol: 10',
      'Krenko, Mob Boss of Dave -> Carol: 15',
    ])
  })

  it('follows the commander to the graveyard and to a mutate host', () => {
    // Two commanders owned by Alice whose damage is not reported by their commandList
    // entry: one sits in the graveyard, the other was mutated under an enemy creature.
    const alice = makePlayer({
      playerId: 'p1',
      name: 'Alice',
      commandList: [commanderCard('cmd-a', 'Krenko, Mob Boss', []), commanderCard('cmd-k', 'Karina, the Somber Chart', [])],
      graveyard: { 'g-1': commanderCard('cmd-a', 'Krenko, Mob Boss', [commanderDamageRule(4, 'Bob')]) },
    })
    const bob = makePlayer({ playerId: 'p2', name: 'Bob' })
    const carol = makePlayer({
      playerId: 'p3',
      name: 'Carol',
      battlefield: {
        'perm-host': makePermanent({
          id: 'perm-host',
          name: 'Progenitor Mimic',
          mutateView: { name: 'Progenitor Mimic', id: 'perm-host', cards: { 'cmd-k': commanderCard('cmd-k', 'Karina, the Somber Chart', [commanderDamageRule(9, 'Bob')]) } },
        }),
      },
    })
    const gv = makeGameView({ players: [alice, bob, carol] })
    const [krenko, karina] = commandersOf(alice)
    expect(commanderDamageDealt(gv, krenko, bob)).toBe(4)
    expect(commanderDamageDealt(gv, karina, bob)).toBe(9)
  })
})
