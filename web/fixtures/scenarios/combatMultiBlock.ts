import { TABLE } from '../table-names'
/**
 * Escenario determinista del FixtureServer para combate con múltiples bloqueadores:
 * 1. Humano ataca con Colossal Dreadmaw (6/6).
 * 2. Sim bloquea con Grizzly Bears (2/2) y Raging Goblin (1/1).
 * 3. Paso de Asignación de Daño (Damage Distribution - GAME_GET_MULTI_AMOUNT). XMage no
 *    pide orden de bloqueadores: la regla de damage assignment order ya no existe en el motor.
 * 4. Resolución de daño de combate.
 */

import { makeBaseScenario } from '../fake'
import type { Scenario } from '../fake'
import { makePermanent } from '../../src/__fixtures__/gameViews'
import type { CardView, GameView, ManaPoolView, PermanentView, PlayerView } from '../../src/net/types'
import {
  GAME_ID, TABLE_ID, SIM_NAME, HUMAN_NAME, HUMAN_PLAYER_ID, SIM_PLAYER_ID,
} from '../humanGameConstants'

export function combatMultiBlockScenario(): Scenario {
  const tableId = TABLE_ID
  const gameId = GAME_ID

  const myAttacker: PermanentView = makePermanent({
    name: 'Colossal Dreadmaw',
    displayName: 'Colossal Dreadmaw',
    parentId: 'my-dreadmaw',
    controlled: true,
    power: '6',
    toughness: '6',
    cardTypes: ['Creature'],
  })

  const simBlocker1: PermanentView = makePermanent({
    name: 'Grizzly Bears',
    displayName: 'Grizzly Bears',
    parentId: 'sim-bears',
    power: '2',
    toughness: '2',
    cardTypes: ['Creature'],
  })

  const simBlocker2: PermanentView = makePermanent({
    name: 'Raging Goblin',
    displayName: 'Raging Goblin',
    parentId: 'sim-goblin',
    power: '1',
    toughness: '1',
    cardTypes: ['Creature'],
  })

  let stage: 'attack' | 'blocked' | 'damage' | 'resolved' = 'attack'

  const getGameView = (combatGroups: unknown[] = []): GameView => ({
    turn: 3,
    phase: 'COMBAT',
    step: stage === 'attack' ? 'DECLARE_ATTACKERS' : stage === 'blocked' ? 'DECLARE_BLOCKERS' : stage === 'damage' ? 'COMBAT_DAMAGE' : 'POSTCOMBAT_MAIN',
    activePlayerId: HUMAN_PLAYER_ID,
    priorityPlayerId: HUMAN_PLAYER_ID,
    combat: combatGroups as unknown as GameView['combat'],
    players: [
      {
        playerId: HUMAN_PLAYER_ID,
        name: HUMAN_NAME,
        life: 20,
        controlled: true,
        isActive: true,
        hasPriority: true,
        battlefield: { [myAttacker.parentId!]: myAttacker },
        libraryCount: 40,
        handCount: 5,
        graveyard: {},
        exile: {},
        commandList: [],
        manaPool: {} as ManaPoolView,
      } as unknown as PlayerView,
      {
        playerId: SIM_PLAYER_ID,
        name: SIM_NAME,
        life: 20,
        controlled: false,
        isActive: false,
        hasPriority: false,
        battlefield:
          stage === 'resolved'
            ? {}
            : {
                [simBlocker1.parentId!]: simBlocker1,
                [simBlocker2.parentId!]: simBlocker2,
              },
        libraryCount: 40,
        handCount: 5,
        graveyard:
          stage === 'resolved'
            ? {
                'sim-bears': { name: 'Grizzly Bears', displayName: 'Grizzly Bears', manaValue: 2 } as CardView,
                'sim-goblin': { name: 'Raging Goblin', displayName: 'Raging Goblin', manaValue: 1 } as CardView,
              }
            : {},
        exile: {},
        commandList: [],
        manaPool: {} as ManaPoolView,
      } as unknown as PlayerView,
    ],
    stack: {},
    canPlayObjects: {},
  } as unknown as GameView)

  return makeBaseScenario({
    tableId,
    tableName: TABLE.combatMultiBlock,
    gameId,
    getGameView: () => getGameView(),
    onStartMatch: (conn) => {
      conn.broadcast(
        'GAME_SELECT',
        {
          message: 'Select attackers',
          options: { possibleAttackers: [myAttacker.parentId!], specialButton: 'All attack' },
          gameView: getGameView(),
        },
        GAME_ID,
      )
    },
    onSendPlayerUUID: (conn) => {
      // Declaring Colossal Dreadmaw as attacker (taps because no vigilance)
      myAttacker.tapped = true
      const combatGroups = [{ attackers: { [myAttacker.parentId!]: {} }, blockers: {}, isBlocked: false }]
      conn.broadcast('GAME_UPDATE', { gameView: getGameView(combatGroups) }, GAME_ID)
      conn.broadcast(
        'GAME_SELECT',
        {
          message: 'Select attackers',
          options: { possibleAttackers: [myAttacker.parentId!], specialButton: 'All attack' },
          gameView: getGameView(combatGroups),
        },
        GAME_ID,
      )
    },
    onSendPlayerBoolean: (conn) => {
      if (stage === 'attack') {
        // Confirm attackers -> Sim declares 2 blockers on Colossal Dreadmaw!
        stage = 'blocked'
        const multiBlockCombat = [
          {
            attackers: { [myAttacker.parentId!]: {} },
            blockers: {
              [simBlocker1.parentId!]: {},
              [simBlocker2.parentId!]: {},
            },
            isBlocked: true,
            defenderId: SIM_PLAYER_ID,
          },
        ]
        conn.broadcast('GAME_UPDATE', { gameView: getGameView(multiBlockCombat) }, GAME_ID)

        stage = 'damage'
        setTimeout(() => {
          conn.broadcast(
            'GAME_GET_MULTI_AMOUNT',
            {
              message: 'Asigna el daño de combate de Colossal Dreadmaw (6 puntos)',
              messages: [
                { id: simBlocker1.parentId!, message: 'Daño a Grizzly Bears (mínimo 2 letal)', min: 2, max: 5, defaultValue: 2 },
                { id: simBlocker2.parentId!, message: 'Daño a Raging Goblin (restante)', min: 1, max: 4, defaultValue: 4 },
              ],
              gameView: getGameView(multiBlockCombat),
            },
            GAME_ID,
          )
        }, 1200)
      }
    },
    onSendPlayerString: (conn) => {
      if (stage === 'damage') {
        // Damage amounts sent -> Resolve combat damage and cleanup blockers
        stage = 'resolved'
        conn.broadcast('GAME_UPDATE', { gameView: getGameView([]) }, GAME_ID)
        conn.broadcast(
          'GAME_INFORM',
          { message: 'Colossal Dreadmaw asigna 2 de daño a Grizzly Bears y 4 de daño a Raging Goblin. Ambos bloqueadores mueren.' },
          GAME_ID,
        )
      }
    },
  })
}
