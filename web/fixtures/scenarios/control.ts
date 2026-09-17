import { TABLE } from '../table-names'
import { makeBaseScenario, type FakeConn, type Scenario } from '../fake'
import { makeCard, makeGameView, makePlayer, makePermanent } from '../../src/__fixtures__/gameViews'
import type { CardView, GameView, PlayableObjectStats, SimpleCardsView } from '../../src/net/types'

/**
 * Control total del turno ajeno (Mindslaver & cía.): la prioridad es del
 * jugador NO controlado (sim-000040, activo) y su mano viaja en
 * `opponentHands` (como en el servidor real cuando controlamos). Sus objetos
 * jugables (una tierra y un artefacto) van en `canPlayObjects`, así que
 * `playableIds` los marca y la UI debe poder clicarlos/pasarlos en su nombre.
 */

export const CONTROL_GAME_ID = 'game-control-1'
export const CONTROL_TABLE_ID = 'table-control-1'
export const CONTROL_HUMAN_ID = 'human-1'
export const CONTROL_HUMAN_NAME = 'Mage Web'
export const CONTROL_SIM_ID = 'sim-2'
export const CONTROL_SIM_NAME = 'sim-000040'
export const CONTROL_HUMAN_HAND_ID = 'human-hand-1'
export const CONTROL_HAND_ID = 'sim-hand-1'
export const CONTROL_HAND_ID_2 = 'sim-hand-2'
export const CONTROL_LAND_ID = 'sim-land-1'
export const CONTROL_BATTLE_ID = 'sim-art-1'
export const CONTROL_CREATURE_ID = 'sim-creature-1'

const SIM_HAND: Array<{ id: string; name: string }> = [
  { id: CONTROL_HAND_ID, name: 'Lightning Bolt' },
  { id: CONTROL_HAND_ID_2, name: 'Island' },
]

export function controlScenario(): Scenario {
  let simHand = [...SIM_HAND]
  let simArtTapped = false
  let controlledCombat = false
  let simCreatureAttacking = false

  const view = (): GameView => {
    const human = makePlayer({
      playerId: CONTROL_HUMAN_ID,
      name: CONTROL_HUMAN_NAME,
      controlled: true,
      isHuman: true,
      isActive: false,
      hasPriority: false,
      handCount: 1,
      battlefield: {
        'human-land-1': makePermanent({ name: 'Mountain', parentId: 'human-land-1', controlled: true, cardTypes: ['Land'] }),
      },
    })
    const sim = makePlayer({
      playerId: CONTROL_SIM_ID,
      name: CONTROL_SIM_NAME,
      controlled: false,
      isHuman: false,
      isActive: true,
      hasPriority: true,
      handCount: simHand.length,
      battlefield: {
        [CONTROL_LAND_ID]: makePermanent({ name: 'Island', parentId: CONTROL_LAND_ID, cardTypes: ['Land'] }),
        [CONTROL_BATTLE_ID]: makePermanent({
          name: 'Mox Jet',
          parentId: CONTROL_BATTLE_ID,
          cardTypes: ['Artifact'],
          tapped: simArtTapped,
        }),
        [CONTROL_CREATURE_ID]: makePermanent({
          name: 'Grizzly Bears',
          parentId: CONTROL_CREATURE_ID,
          cardTypes: ['Creature'],
          power: '2',
          toughness: '2',
        }),
      },
    })
    const myHand: Record<string, CardView> = {
      [CONTROL_HUMAN_HAND_ID]: makeCard({ name: 'Mountain', parentId: CONTROL_HUMAN_HAND_ID }),
    }
    const simHandView: SimpleCardsView = {}
    for (const card of simHand) {
      simHandView[card.id] = { id: card.id, name: card.name, expansionSetCode: 'LEA', cardNumber: '0' }
    }
    const opponentHands: Record<string, SimpleCardsView> = { [CONTROL_SIM_NAME]: simHandView }
    const objects: Record<string, PlayableObjectStats> = {
      [CONTROL_LAND_ID]: {},
      [CONTROL_BATTLE_ID]: {},
    }
    for (const card of simHand) objects[card.id] = {}
    return makeGameView({
      players: [human, sim],
      myPlayerId: CONTROL_HUMAN_ID,
      myHand,
      opponentHands,
      canPlayObjects: { objects },
      phase: controlledCombat ? 'COMBAT' : 'MAIN',
      step: controlledCombat ? 'DECLARE_ATTACKERS' : 'PRECOMBAT_MAIN',
      activePlayerId: CONTROL_SIM_ID,
      activePlayerName: CONTROL_SIM_NAME,
      priorityPlayerName: CONTROL_SIM_NAME,
      combat: simCreatureAttacking ? [{ attackers: { [CONTROL_CREATURE_ID]: {} } }] : [],
      turn: 3,
    })
  }

  const emitControlledCombat = (conn: FakeConn): void => {
    conn.broadcast(
      'GAME_SELECT',
      {
        message: `Select attackers (as ${CONTROL_SIM_NAME})`,
        options: { possibleAttackers: [CONTROL_CREATURE_ID], specialButton: 'All attack' },
        gameView: view(),
      },
      CONTROL_GAME_ID,
    )
  }

  return makeBaseScenario({
    tableId: CONTROL_TABLE_ID,
    tableName: TABLE.control,
    gameId: CONTROL_GAME_ID,
    getGameView: view,
    selectMessage: `Priority (as ${CONTROL_SIM_NAME})`,
    onSendPlayerUUID: (conn, uuid) => {
      if (uuid === CONTROL_BATTLE_ID) simArtTapped = true
      if (uuid === CONTROL_CREATURE_ID) simCreatureAttacking = true
      if (simHand.some((c) => c.id === uuid)) simHand = simHand.filter((c) => c.id !== uuid)
      if (controlledCombat) emitControlledCombat(conn)
      else conn.broadcast('GAME_UPDATE', { gameView: view() }, CONTROL_GAME_ID)
    },
    onSendPlayerBoolean: (conn) => {
      if (!controlledCombat) {
        controlledCombat = true
        emitControlledCombat(conn)
        return
      }
      conn.broadcast('GAME_UPDATE', { gameView: view() }, CONTROL_GAME_ID)
    },
  })
}
