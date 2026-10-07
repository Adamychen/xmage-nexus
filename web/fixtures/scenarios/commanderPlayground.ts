/**
 * Commander playground: a hand-driven 4-player Commander game for manual UI
 * testing without Java, proxy or XMage server (`npm run play:fake`).
 *
 * - Click your commander (card or crown) to cast it; the tax grows each cast.
 * - Click it on the battlefield to send it back to the command zone.
 * - Click a land in hand to play it (one per turn); Pass starts a new turn.
 * - Opponents show partners, a companion and an emblem for the mini zones.
 */

import { makeBaseScenario, makeTable, type FakeConn, type Scenario } from '../fake'
import { commanderInfoRule, makeCard, makeGameView, makePermanent, makePlayer } from '../../src/__fixtures__/gameViews'
import type { CardView, GameView, PermanentView, TableView } from '../../src/net/types'

export const PLAYGROUND_TABLE_ID = 'table-commander-playground'
export const PLAYGROUND_GAME_ID = 'game-commander-playground'
export const PLAYGROUND_TABLE_NAME = 'Commander playground'

const ME_ID = 'pg-me'
const MY_COMMANDER_ID = 'pg-cmd-atraxa'
const OPPONENTS = ['sim-kraum', 'sim-krenko', 'sim-edgar'] as const

function commander(id: string, name: string, castCount: number, extra: Partial<CardView> = {}): CardView {
  return makeCard({
    id,
    parentId: id,
    name,
    displayName: name,
    cardTypes: ['Creature'],
    superTypes: ['Legendary'],
    mageObjectType: 'COMMANDER',
    ...extra,
    rules: extra.mageObjectType === 'COMPANION' ? extra.rules : [...(extra.rules ?? []), commanderInfoRule(castCount)],
  })
}

function land(id: string, name: string, tapped = false): PermanentView {
  return makePermanent({ id, parentId: id, name, displayName: name, cardTypes: ['Land'], controlled: true, tapped })
}

export function commanderPlaygroundScenario(): Scenario {
  let username = 'You'
  let turn = 1
  let landPlayed = false
  let castCount = 0
  let commanderOnBattlefield = false
  let note = 'Click your commander (or its crown) to cast it.'

  const myLands: Record<string, PermanentView> = {
    'pg-forest': land('pg-forest', 'Forest'),
    'pg-island': land('pg-island', 'Island'),
    'pg-plains': land('pg-plains', 'Plains'),
    'pg-swamp': land('pg-swamp', 'Swamp'),
  }
  const myHand: Record<string, CardView> = {
    'pg-h-forest': makeCard({ id: 'pg-h-forest', name: 'Forest', cardTypes: ['Land'] }),
    'pg-h-tower': makeCard({ id: 'pg-h-tower', name: 'Command Tower', cardTypes: ['Land'] }),
    'pg-h-cultivate': makeCard({ id: 'pg-h-cultivate', name: 'Cultivate', cardTypes: ['Sorcery'], manaValue: 3, manaCostLeftStr: ['{2}{G}'] }),
    'pg-h-swords': makeCard({ id: 'pg-h-swords', name: 'Swords to Plowshares', cardTypes: ['Instant'], manaValue: 1, manaCostLeftStr: ['{W}'] }),
  }

  const atraxa = (): CardView =>
    commander(MY_COMMANDER_ID, "Atraxa, Praetors' Voice", castCount, {
      manaValue: 4,
      manaCostLeftStr: ['{G}{W}{U}{B}'],
      power: '4',
      toughness: '4',
      rules: ['Flying, vigilance, deathtouch, lifelink', 'At the beginning of your end step, proliferate.'],
    })

  const getGameView = (): GameView => {
    const battlefield: Record<string, PermanentView> = { ...myLands }
    if (commanderOnBattlefield) {
      battlefield[MY_COMMANDER_ID] = { ...(atraxa() as PermanentView), controlled: true, cardTypes: ['Creature'] }
    }
    const playable: Record<string, unknown> = {}
    if (!commanderOnBattlefield) playable[MY_COMMANDER_ID] = { basicCastAbilities: [{ id: MY_COMMANDER_ID, value: 'Cast commander' }] }
    else playable[MY_COMMANDER_ID] = { basicCastAbilities: [{ id: MY_COMMANDER_ID, value: 'Return to command zone' }] }
    if (!landPlayed) {
      for (const [id, card] of Object.entries(myHand)) {
        if (card.cardTypes?.includes('Land')) playable[id] = { basicCastAbilities: [{ id, value: 'Play land' }] }
      }
    }

    const me = makePlayer({
      playerId: ME_ID,
      name: username,
      controlled: true,
      isActive: true,
      hasPriority: true,
      life: 40,
      handCount: Object.keys(myHand).length,
      libraryCount: 92,
      commandList: commanderOnBattlefield ? [] : [atraxa()],
      battlefield,
    })
    const kraum = makePlayer({
      playerId: OPPONENTS[0],
      name: 'sim-kraum',
      life: 37,
      handCount: 5,
      libraryCount: 90,
      commandList: [
        commander('pg-cmd-kraum', "Kraum, Ludevic's Opus", 0, { manaValue: 5 }),
        commander('pg-cmd-tymna', 'Tymna the Weaver', 2, { manaValue: 3 }),
      ],
      battlefield: { 'pg-o1-mountain': land('pg-o1-mountain', 'Mountain'), 'pg-o1-plains': land('pg-o1-plains', 'Plains', true) },
    })
    const krenko = makePlayer({
      playerId: OPPONENTS[1],
      name: 'sim-krenko',
      life: 40,
      handCount: 6,
      libraryCount: 91,
      commandList: [
        commander('pg-cmd-krenko', 'Krenko, Mob Boss', 1, { manaValue: 4 }),
        { id: 'pg-emblem', name: 'Emblem Chandra', displayName: 'Emblem - Chandra, Torch of Defiance', mageObjectType: 'EMBLEM', manaValue: 0 } as CardView,
      ],
      battlefield: { 'pg-o2-mountain': land('pg-o2-mountain', 'Mountain') },
    })
    const edgar = makePlayer({
      playerId: OPPONENTS[2],
      name: 'sim-edgar',
      life: 31,
      handCount: 4,
      libraryCount: 89,
      commandList: [
        commander('pg-cmd-edgar', 'Edgar Markov', 0, { manaValue: 6 }),
        commander('pg-cmp-lurrus', 'Lurrus of the Dream-Den', 0, {
          manaValue: 3,
          mageObjectType: 'COMPANION',
          rules: ['Companion — Each permanent card in your starting deck has mana value 2 or less.'],
        }),
      ],
      battlefield: { 'pg-o3-swamp': land('pg-o3-swamp', 'Swamp') },
    })

    return makeGameView({
      gameId: PLAYGROUND_GAME_ID,
      turn,
      phase: 'PRECOMBAT_MAIN',
      step: 'PRECOMBAT_MAIN',
      activePlayerId: ME_ID,
      activePlayerName: username,
      priorityPlayerName: username,
      myPlayerId: ME_ID,
      players: [me, kraum, krenko, edgar],
      myHand: { ...myHand },
      canPlayObjects: { objects: playable } as GameView['canPlayObjects'],
    })
  }

  const select = (conn: FakeConn) => {
    const gameView = getGameView()
    conn.broadcast('GAME_UPDATE', { gameView }, PLAYGROUND_GAME_ID)
    conn.broadcast('GAME_SELECT', { message: note, options: { specialButton: 'Pass' }, gameView }, PLAYGROUND_GAME_ID)
  }

  const nextTurn = (conn: FakeConn) => {
    turn += 1
    landPlayed = false
    note = `Turn ${turn}: play a land or cast your commander.`
    select(conn)
  }

  const base = makeBaseScenario({
    tableId: PLAYGROUND_TABLE_ID,
    tableName: PLAYGROUND_TABLE_NAME,
    gameId: PLAYGROUND_GAME_ID,
    gameType: 'Commander Free For All',
    getGameView,
    onStartMatch: (conn) => select(conn),
    onSendPlayerUUID: (conn, uuid) => {
      if (uuid === MY_COMMANDER_ID && !commanderOnBattlefield) {
        castCount += 1
        commanderOnBattlefield = true
        note = `Atraxa cast (cast #${castCount}). Click it on the battlefield to send it back to the command zone.`
      } else if (uuid === MY_COMMANDER_ID) {
        commanderOnBattlefield = false
        note = `Atraxa went back to the command zone. Commander tax is now +${castCount * 2}.`
      } else if (myHand[uuid]?.cardTypes?.includes('Land') && !landPlayed) {
        const card = myHand[uuid]
        delete myHand[uuid]
        myLands[uuid] = land(uuid, card.name)
        landPlayed = true
        note = `${card.name} played. Pass to start a new turn.`
      } else {
        note = 'That does nothing in the playground. Try your commander or a land.'
      }
      select(conn)
    },
    onSendPlayerBoolean: (conn) => nextTurn(conn),
    onSendPlayerAction: (conn, action) => {
      if (/^PASS_PRIORITY/.test(action)) nextTurn(conn)
    },
  })

  const table = (): TableView => ({
    ...makeTable({
      tableId: PLAYGROUND_TABLE_ID,
      tableName: PLAYGROUND_TABLE_NAME,
      gameId: PLAYGROUND_GAME_ID,
      gameType: 'Commander Free For All',
      deckType: 'Variant Magic - Commander',
      controllerName: username,
      seats: [
        { playerName: username, seatIndex: 0, playerType: 'HUMAN' },
        ...OPPONENTS.map((name, i) => ({ playerName: name, seatIndex: i + 1, playerType: 'SIM' })),
      ],
    }),
    seatsInfo: '4/4',
    additionalInfoShort: '4/4',
  })

  return {
    onConnect: (conn) => {
      conn.raw({ type: 'connected', message: 'Proxy ready.' })
      conn.raw({ type: 'info', message: 'Proxy ready.' })
      conn.lobby([table()])
    },
    onAction: (conn, action, args, requestId) => {
      if (action === 'connect') {
        const name = String(args.username ?? '').trim()
        if (name) {
          username = name
          conn.username = name
        }
        conn.ok(requestId, action, { tableId: PLAYGROUND_TABLE_ID })
        conn.lobby([table()])
        return
      }
      if (action === 'createTable' || action === 'createTournamentTable') {
        conn.ok(requestId, action, { tableId: PLAYGROUND_TABLE_ID })
        conn.lobby([table()])
        return
      }
      base.onAction?.(conn, action, args, requestId)
    },
  }
}
